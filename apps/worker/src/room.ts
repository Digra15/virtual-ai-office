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
  EventPostSchema,
  type ActivityEntry,
  type AgentInfo,
  type EventPost,
  type HealthResponse,
  type ServerMessage,
} from '@virtual-ai-office/shared';
import { AgentRegistry, type RegistrySnapshot } from './registry';
import { SlidingWindowLimiter } from './ratelimit';
import { demoTick } from './demo';
import { loadWorkerConfig, type Env } from './env';

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
      const stored = await ctx.storage.get<StoredState>(STATE_KEY);
      if (stored) {
        this.registry.restore(stored);
        this.bootedAt = stored.bootedAt;
      } else {
        this.bootedAt = Date.now();
        const cfg = loadWorkerConfig(env);
        if (cfg.demoMode) this.registry.seedDemoAgents();
        await this.persist();
      }
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
    if (request.method === 'GET' && pathname === '/api/agents') {
      return json({ agents: this.registry.list() });
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

    return json({ error: 'Not found' }, 404);
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
    const msg = parsed as { type?: unknown; agentId?: unknown };
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

    const changed = this.registry.markOfflineSweep(cfg.offlineTimeoutMs);
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
