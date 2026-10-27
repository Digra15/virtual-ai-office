/**
 * AgentRoom — the Durable Object that owns ALL backend state.
 *
 * One singleton instance (`idFromName("global")`) holds the agent registry
 * (persisted in `ctx.storage`), the WebSocket clients, the demo simulator
 * and the offline sweeper. This mirrors `apps/server` (same REST contracts,
 * same WS protocol, same Zod validation) with two adaptations:
 *
 *   - persistence: registry snapshots survive restarts via DO storage
 *     (the Node server is in-memory only);
 *   - scheduling: demo ticks + offline sweeps run on `alarm()` instead of
 *     `setInterval` (no timers in the Workers runtime).
 *
 * Monitoring only: no endpoint executes anything on behalf of agents.
 */
import { DurableObject } from 'cloudflare:workers';
import {
  ADMIN_BROADCAST_TYPES,
  EventPostSchema,
  GuestChatPostSchema,
  GuestReplySchema,
  SiteConfigSchema,
  TaskPostSchema,
  type ActivityEntry,
  type AgentInfo,
  type EventPost,
  type HealthResponse,
  type ServerMessage,
} from '@virtual-ai-office/shared';
import { AgentRegistry, isLiveSeat, type RegistrySnapshot } from './registry';
import { SlidingWindowLimiter } from './ratelimit';
import { demoTick } from './demo';
import { loadWorkerConfig, type Env } from './env';
import { timingSafeEqual } from './admin/auth';
import {
  getReceptionistConfigWithStored,
  requestReceptionistReply,
  type ChatHistoryItem,
} from './receptionist';

const STATE_KEY = 'vao-state-v1';
const ALARM_FLAG_KEY = 'vao-alarm-set';
const TICK_MS = 3000;
const DEFAULT_EVENTS_LIMIT = 50;
const MAX_EVENTS_LIMIT = 200;

interface StoredState extends RegistrySnapshot {
  bootedAt: number;
}

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_EVENTS_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n <= 0) return DEFAULT_EVENTS_LIMIT;
  return Math.min(n, MAX_EVENTS_LIMIT);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export class AgentRoom extends DurableObject<Env> {
  private readonly registry = new AgentRegistry();
  private readonly limiter = new SlidingWindowLimiter(60_000, 60);
  private bootedAt = Date.now();
  private ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Load persisted state before serving any request.
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const cfg = loadWorkerConfig(env);
      const stored = await ctx.storage.get<StoredState>(STATE_KEY);
      let changed = false;
      if (stored) {
        this.registry.restore(stored);
        this.bootedAt = stored.bootedAt;
      } else {
        this.bootedAt = Date.now();
        if (cfg.demoMode) this.registry.seedDemoAgents();
        changed = true;
      }
      if (!cfg.demoMode) {
        // No demo, ever: purge demo agents persisted from an earlier
        // deployment and seed the 3 live seats (idempotent).
        changed = this.registry.purgeDemoAgents() > 0 || changed;
        changed = this.registry.seedLiveAgents() > 0 || changed;
      }
      // Runtime site settings: the env var seeds the offline timeout on a
      // fresh deployment; a saved config wins over the env var afterwards.
      changed = this.registry.ensureSiteConfig(cfg.offlineTimeoutMs) || changed;
      if (changed) await this.persist();
    });
  }

  // ------------------------------------------------------------------ fetch

  override async fetch(request: Request): Promise<Response> {
    await this.ready;
    try {
      return await this.route(request);
    } catch (e) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      return json({ error: `Durable Object failure: ${msg}` }, 500);
    }
  }

  private async route(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // WebSocket upgrade.
    if (pathname === '/ws') {
      return this.handleWsUpgrade(request);
    }

    if (request.method === 'GET' && pathname === '/health') {
      return this.handleHealth();
    }
    // Internal broadcast channel: the Worker (admin mutations) POSTs here
    // with the shared INTERNAL_SECRET; the DO fans the message out to all
    // connected WS clients. Never exposed publicly — index.ts only routes
    // /api/* and /ws to this DO.
    if (request.method === 'POST' && pathname === '/__internal/publish') {
      return this.handleInternalPublish(request);
    }
    if (request.method === 'GET' && pathname === '/api/agents') {
      return json({ agents: this.registry.list() });
    }

    // Runtime site settings (DO storage, no D1 needed). GET is public;
    // POST requires the agent bearer secret (interim auth until the full
    // admin session auth lands — the browser never holds the secret).
    if (pathname === '/api/config') {
      if (request.method === 'GET') {
        return json({ config: this.registry.getSiteConfig() });
      }
      if (request.method === 'POST') {
        return this.handlePostConfig(request);
      }
    }

    // Receptionist API key (DO storage, server-side only). Unlike
    // /api/config, BOTH directions require the agent bearer secret —
    // GET returns only { hasKey }, never the value, so the admin panel
    // can show a status line without ever receiving the key. The key
    // itself is deliberately NOT part of SiteConfigSchema: GET
    // /api/config is public and must never be able to return it.
    if (pathname === '/api/config/receptionist-key') {
      const authError = this.requireAgentAuth(request);
      if (authError) return authError;
      if (request.method === 'GET') {
        return json({ hasKey: this.registry.hasReceptionistApiKey() });
      }
      if (request.method === 'POST') {
        return this.handlePostReceptionistKey(request);
      }
    }

    // Guest chat (visitor → Difia). POST + thread GET are public but
    // rate-limited and cooldown-guarded; a visitor only ever sees their
    // own thread. Replies and the pending queue require AGENT_SECRET.
    if (pathname === '/api/guest-chat') {
      if (request.method === 'POST') {
        return this.handleGuestPost(request);
      }
      if (request.method === 'GET') {
        const guestId = url.searchParams.get('guestId') ?? '';
        if (!guestId) return json({ error: 'guestId is required' }, 400);
        const thread = this.registry.getGuestThread(guestId);
        return json({
          thread: thread ?? { guestId, guestName: 'Tamu', messages: [], updatedAt: 0 },
        });
      }
    }
    // Public by design: returns ONLY { pendingCount } — a bare number
    // with no message content, guestIds, or guest names — so the VM
    // watcher service and hook detectors can poll it without any
    // credential. The full queue stays behind AGENT_SECRET below.
    if (request.method === 'GET' && pathname === '/api/guest-chat/pending-count') {
      return json({ pendingCount: this.registry.pendingGuestCount() });
    }
    if (request.method === 'GET' && pathname === '/api/guest-chat/pending') {
      const authError = this.requireAgentAuth(request);
      if (authError) return authError;
      return json({ pending: this.registry.pendingGuestMessages() });
    }
    const guestReplyMatch = pathname.match(/^\/api\/guest-chat\/([^/]+)\/reply$/);
    if (guestReplyMatch && request.method === 'POST') {
      const authError = this.requireAgentAuth(request);
      if (authError) return authError;
      return this.handleGuestReply(request, decodeURIComponent(guestReplyMatch[1] ?? ''), 'difia');
    }

    // Internal guest-chat channel for the admin API (routes.ts): the
    // Worker forwards session-authenticated admin requests here with
    // INTERNAL_SECRET, exactly like /__internal/publish. Never public.
    if (pathname === '/__internal/guest-chat') {
      const internalError = this.requireInternalSecret(request);
      if (internalError) return internalError;
      if (request.method === 'GET') {
        return json({ threads: this.registry.listGuestThreads() });
      }
    }
    const internalReplyMatch = pathname.match(/^\/__internal\/guest-chat\/([^/]+)\/reply$/);
    if (internalReplyMatch && request.method === 'POST') {
      const internalError = this.requireInternalSecret(request);
      if (internalError) return internalError;
      return this.handleGuestReply(request, decodeURIComponent(internalReplyMatch[1] ?? ''), 'admin');
    }

    const agentMatch = pathname.match(/^\/api\/agents\/([^/]+)(\/events)?$/);
    if (agentMatch) {
      const agentId = decodeURIComponent(agentMatch[1] ?? '');
      const isEvents = agentMatch[2] === '/events';
      if (request.method === 'GET' && !isEvents) {
        const agent = this.registry.get(agentId);
        if (!agent) return json({ error: `Unknown agent: ${agentId}` }, 404);
        return json({ agent });
      }
      if (request.method === 'GET' && isEvents) {
        const events = this.registry.recentEvents(agentId, parseLimit(url.searchParams.get('limit')));
        if (!events) return json({ error: `Unknown agent: ${agentId}` }, 404);
        return json({ events });
      }
      if (request.method === 'POST' && isEvents) {
        return this.handlePostEvent(request, agentId);
      }
    }

    // Task queue (office → agent). All three endpoints require AGENT_SECRET.
    const taskMatch = pathname.match(/^\/api\/agents\/([^/]+)\/tasks(?:\/([^/]+)\/complete)?$/);
    if (taskMatch) {
      const agentId = decodeURIComponent(taskMatch[1] ?? '');
      const taskId = taskMatch[2] ? decodeURIComponent(taskMatch[2]) : null;
      const authError = this.requireAgentAuth(request);
      if (authError) return authError;
      if (!this.registry.get(agentId)) return json({ error: `Unknown agent: ${agentId}` }, 404);
      if (request.method === 'POST' && taskId === null) {
        return this.handleCreateTask(request, agentId);
      }
      if (request.method === 'GET' && taskId === null) {
        const statusParam = url.searchParams.get('status');
        const status = statusParam === 'pending' || statusParam === 'done' ? statusParam : undefined;
        return json({ tasks: this.registry.listTasks(agentId, status) });
      }
      if (request.method === 'POST' && taskId !== null) {
        const task = this.registry.completeTask(agentId, taskId);
        if (!task) return json({ error: `Unknown task: ${taskId}` }, 404);
        await this.persist();
        return json({ task });
      }
    }

    return json({ error: 'Not found' }, 404);
  }

  /**
   * Agent-reporting auth (fail closed). Returns an error Response when the
   * request is not authorized, or null when it is. The secret lives only
   * in Worker secrets — the browser never holds it.
   */
  private requireAgentAuth(request: Request): Response | null {
    const secret = this.env.AGENT_SECRET;
    if (!secret) {
      return json({ error: 'Agent reporting not configured — set AGENT_SECRET' }, 503);
    }
    const provided = request.headers.get('Authorization') ?? '';
    if (!provided.startsWith('Bearer ') || !timingSafeEqual(provided.slice('Bearer '.length), secret)) {
      return json({ error: 'Forbidden' }, 403);
    }
    return null;
  }

  private async handleCreateTask(request: Request, agentId: string): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    const parsed = TaskPostSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Invalid task payload', details: parsed.error.flatten() }, 400);
    }
    const task = this.registry.createTask(agentId, parsed.data.title, parsed.data.detail);
    await this.persist();
    return json({ task }, 201);
  }

  /**
   * POST /api/config — replace the runtime site settings. Requires the
   * agent bearer secret (same interim auth as task endpoints). Validates
   * the full object; unknown keys are stripped by the schema.
   */
  private async handlePostConfig(request: Request): Promise<Response> {
    const authError = this.requireAgentAuth(request);
    if (authError) return authError;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    const parsed = SiteConfigSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Invalid config payload', details: parsed.error.flatten() }, 400);
    }
    const config = this.registry.setSiteConfig(parsed.data);
    await this.persist();
    return json({ config });
  }

  /**
   * POST /api/config/receptionist-key — set (or clear, with an empty
   * string) the admin-panel-managed receptionist API key. Bearer auth
   * already checked by the route. The value is stored in DO storage
   * only and is never returned by any endpoint.
   */
  private async handlePostReceptionistKey(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    const key = (body as { key?: unknown } | null)?.key;
    if (typeof key !== 'string' || key.length > 500) {
      return json({ error: 'Invalid key: expected a string of at most 500 characters' }, 400);
    }
    const hasKey = this.registry.setReceptionistApiKey(key);
    await this.persist();
    return json({ hasKey });
  }

  /**
   * POST /api/guest-chat — a visitor writes to Difia. Public, but
   * per-IP rate-limited (same window as agent events) and guarded by a
   * 15 s per-thread cooldown so one guest cannot flood the queue.
   */
  private async handleGuestPost(request: Request): Promise<Response> {
    const cfg = loadWorkerConfig(this.env);
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    this.limiter.configure(60_000, cfg.rateLimitPerMinute);
    if (!this.limiter.take(`guest:${ip}`)) {
      return json({ error: 'Rate limit exceeded — slow down and retry.' }, 429);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    const parsed = GuestChatPostSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Invalid guest message', details: parsed.error.flatten() }, 400);
    }
    const result = this.registry.postGuestMessage(
      parsed.data.guestId,
      parsed.data.guestName,
      parsed.data.text,
    );
    if ('cooldownMs' in result) {
      return json(
        { error: 'Tunggu sebentar sebelum mengirim pesan lagi.', retryAfterMs: result.cooldownMs },
        429,
      );
    }
    await this.persist();
    // AI receptionist (when configured): never blocks the 201 — the call
    // runs via waitUntil, and ANY failure leaves the message unanswered so
    // the 1-minute poller answers it as backstop. When the endpoint is
    // unconfigured this is a no-op.
    this.ctx.waitUntil(this.runReceptionistReply(result.thread.guestId, result.message.id));
    return json({ message: result.message, thread: result.thread }, 201);
  }

  /**
   * Ask the configured AI receptionist endpoint for a reply to one guest
   * message and store it as Difia. Best-effort only: every failure path
   * returns silently, leaving the message pending for the poller. The
   * double-reply guard in replyToGuestMessage also protects the case
   * where the poller answered first.
   */
  private async runReceptionistReply(guestId: string, messageId: string): Promise<void> {
    try {
      // Live-read the stored siteConfig and stored key: the admin panel
      // is the primary way to set the endpoint and its key (no redeploy),
      // env vars / CLI secret are fallback.
      const config = getReceptionistConfigWithStored(
        this.env,
        this.registry.getSiteConfig(),
        this.registry.getReceptionistApiKey(),
      );
      if (!config.url) return;
      const thread = this.registry.getGuestThread(guestId);
      if (!thread) return;
      const target = thread.messages.find((m) => m.id === messageId);
      if (!target || target.from !== 'guest') return;
      const history: ChatHistoryItem[] = thread.messages
        .filter((m) => m.id !== messageId)
        .slice(-20)
        .map((m) => ({
          role: m.from === 'guest' ? ('user' as const) : ('assistant' as const),
          text: m.text,
        }));
      const text = await requestReceptionistReply(config, history, target.text);
      if (!text) return;
      const replied = this.registry.replyToGuestMessage(messageId, 'difia', text);
      if (replied) await this.persist();
    } catch {
      // Best-effort: never surface receptionist failures to the guest path.
    }
  }

  /** Shared reply path: agent bearer auth posts as Difia, admin as admin. */
  private async handleGuestReply(
    request: Request,
    messageId: string,
    from: 'difia' | 'admin',
  ): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    const parsed = GuestReplySchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Invalid reply', details: parsed.error.flatten() }, 400);
    }
    const result = this.registry.replyToGuestMessage(messageId, from, parsed.data.text);
    if (!result) {
      // replyToGuestMessage returns null for both unknown messages and
      // double replies; tell them apart so a second same-from reply is a
      // 409 (already replied) instead of a misleading 404.
      if (!this.registry.guestMessageExists(messageId)) {
        return json({ error: `Unknown message: ${messageId}` }, 404);
      }
      return json({ error: 'already replied' }, 409);
    }
    await this.persist();
    return json({ reply: result.reply, thread: result.thread }, 201);
  }

  /** Internal-secret auth for Worker→DO admin forwarding (see publish). */
  private requireInternalSecret(request: Request): Response | null {
    const secret = this.env.INTERNAL_SECRET;
    if (!secret) {
      return json({ error: 'Internal publish not configured' }, 503);
    }
    const provided = request.headers.get('X-Internal-Secret') ?? '';
    if (!timingSafeEqual(provided, secret)) {
      return json({ error: 'Forbidden' }, 403);
    }
    return null;
  }

  private async handleHealth(): Promise<Response> {
    await this.ensureAlarm();
    const cfg = loadWorkerConfig(this.env);
    const body: HealthResponse = {
      status: 'ok',
      uptimeSec: Math.floor((Date.now() - this.bootedAt) / 1000),
      demoMode: cfg.demoMode,
      connectedClients: this.ctx.getWebSockets().length,
      agentCount: this.registry.list().length,
      version: cfg.version,
    };
    return json(body);
  }

  private async handlePostEvent(request: Request, agentId: string): Promise<Response> {
    const cfg = loadWorkerConfig(this.env);

    // Agent reports are authenticated (previously open — anyone could fake
    // a live agent's status). Auth runs before rate limiting.
    const authError = this.requireAgentAuth(request);
    if (authError) return authError;

    // Per-IP sliding-window rate limit (mirrors the Node 60/min limiter).
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    this.limiter.configure(60_000, cfg.rateLimitPerMinute);
    if (!this.limiter.take(`post:${ip}`)) {
      return json({ error: 'Rate limit exceeded — slow down and retry.' }, 429);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const parsed = EventPostSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Invalid event payload', details: parsed.error.flatten() }, 400);
    }

    const { agent, entry } = this.registry.upsertFromEvent(agentId, parsed.data);
    await this.persist();

    this.broadcast({ type: 'agent.update', agent });
    if (entry) {
      this.broadcast({ type: 'agent.event', agentId: agent.id, entry });
    }
    return json({ agent }, 200);
  }

  /**
   * POST /__internal/publish — broadcast an admin live-update to all WS
   * clients. Requires header X-Internal-Secret to match INTERNAL_SECRET
   * (constant-time compare). The message is sent as a bare {type} object —
   * unknown to older clients, which ignore it; the web client handles the
   * admin broadcast types.
   */
  private async handleInternalPublish(request: Request): Promise<Response> {
    const secret = this.env.INTERNAL_SECRET;
    if (!secret) {
      return json({ error: 'Internal publish not configured' }, 503);
    }
    const provided = request.headers.get('X-Internal-Secret') ?? '';
    if (!timingSafeEqual(provided, secret)) {
      return json({ error: 'Forbidden' }, 403);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    const type = (body as { type?: unknown } | null)?.type;
    if (typeof type !== 'string' || !(ADMIN_BROADCAST_TYPES as readonly string[]).includes(type)) {
      return json({ error: 'Invalid broadcast type' }, 400);
    }
    this.broadcast({ type } as unknown as ServerMessage);
    return json({ ok: true });
  }

  // --------------------------------------------------------------- websocket
  private handleWsUpgrade(request: Request): Response {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return json({ error: 'Expected a WebSocket upgrade request' }, 400);
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.sendTo(server, this.snapshotMessage());
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ready;
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      this.sendTo(ws, { type: 'error', message: 'Malformed JSON message' });
      return;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      this.sendTo(ws, { type: 'error', message: 'Message must be a JSON object' });
      return;
    }
    const msg = parsed as { type?: unknown; agentId?: unknown; token?: unknown };
    if (msg.type === 'ping') {
      this.sendTo(ws, {
        type: 'heartbeat',
        serverTime: new Date().toISOString(),
        demoMode: loadWorkerConfig(this.env).demoMode,
      });
      return;
    }
    if (msg.type === 'hello') {
      this.sendTo(ws, this.snapshotMessage());
      return;
    }
    if (msg.type === 'heartbeat' && typeof msg.agentId === 'string' && msg.agentId.length > 0) {
      // Live seats cannot be revived by an unauthenticated WS heartbeat —
      // only authenticated REST reports revive them. Otherwise anyone could
      // fake a live agent's liveness. (No current client sends heartbeats
      // with an agentId, so nothing legitimate breaks.)
      if (isLiveSeat(msg.agentId)) {
        const secret = this.env.AGENT_SECRET;
        const token = typeof msg.token === 'string' ? msg.token : '';
        if (!secret || !timingSafeEqual(token, secret)) {
          this.sendTo(ws, { type: 'error', message: 'Live-seat heartbeat requires a valid token' });
          return;
        }
      }
      // A client heartbeat revives the named agent's lastSeen (and broadcasts
      // the revival when the agent comes back from offline).
      const { agent, entry } = this.registry.upsertFromEvent(msg.agentId, { type: 'heartbeat' });
      await this.persist();
      this.broadcast({ type: 'agent.update', agent });
      if (entry) this.broadcast({ type: 'agent.event', agentId: agent.id, entry });
      return;
    }
    this.sendTo(ws, { type: 'error', message: `Unknown message type: ${String(msg.type)}` });
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    ws.close(1000, 'bye');
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close(1011, 'error');
    } catch {
      // Already gone — nothing to do.
    }
  }

  // ------------------------------------------------------------------- alarm

  /**
   * Periodic tick: demo simulator events (when DEMO_MODE) + offline sweep.
   * Reschedules itself; also re-arms on every REST/WS request in case the
   * alarm was lost (e.g. after a cold start with no traffic).
   */
  override async alarm(): Promise<void> {
    await this.ready;
    const cfg = loadWorkerConfig(this.env);

    if (cfg.demoMode) {
      const updates: Array<{ agent: AgentInfo; entry: ActivityEntry | null }> = [];
      demoTick(this.registry, (agentId: string, event: EventPost) => {
        updates.push(this.registry.upsertFromEvent(agentId, event));
      });
      for (const { agent, entry } of updates) {
        this.broadcast({ type: 'agent.update', agent });
        if (entry) this.broadcast({ type: 'agent.event', agentId: agent.id, entry });
      }
    }

    const changed = this.registry.markOfflineSweep(
      this.registry.getSiteConfig().offlineTimeoutMs,
    );
    for (const agent of changed) {
      this.broadcast({ type: 'agent.update', agent });
    }

    await this.persist();
    await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
  }

  // ----------------------------------------------------------------- helpers

  private snapshotMessage(): ServerMessage {
    return {
      type: 'snapshot',
      agents: this.registry.list(),
      demoMode: loadWorkerConfig(this.env).demoMode,
      serverTime: new Date().toISOString(),
    };
  }

  private broadcast(msg: ServerMessage): void {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(text);
      } catch {
        // Dead socket — close handler cleans it up.
      }
    }
  }

  private sendTo(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // Client gone — nothing to do.
    }
  }

  private async persist(): Promise<void> {
    const snap = this.registry.snapshot();
    const stored: StoredState = { ...snap, bootedAt: this.bootedAt };
    await this.ctx.storage.put(STATE_KEY, stored);
  }

  private async ensureAlarm(): Promise<void> {
    const flag = await this.ctx.storage.get<boolean>(ALARM_FLAG_KEY);
    if (!flag) {
      await this.ctx.storage.put(ALARM_FLAG_KEY, true);
      await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
    }
  }
}
