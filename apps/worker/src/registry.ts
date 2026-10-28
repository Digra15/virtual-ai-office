/**
 * Agent registry — pure agent-state logic for the Cloudflare Worker backend.
 *
 * This is a faithful port of `apps/server/src/store.ts` (same seeds, same
 * mutation rules, same history cap). It is intentionally free of Durable
 * Object APIs so it stays unit-testable under plain vitest; `room.ts` owns
 * persistence (`ctx.storage`) and broadcasting.
 *
 * Monitoring only: this registry never executes anything — it just records
 * what agents report.
 */
import type {
  ActivityEntry,
  ActivityKind,
  AgentGender,
  AgentInfo,
  AgentStatus,
  AgentTask,
  EventPost,
  GuestChatMessage,
  GuestThread,
  SiteConfig,
} from '@virtual-ai-office/shared';
import { DEFAULT_SITE_CONFIG } from '@virtual-ai-office/shared';

/** Maximum activity entries kept per agent (newest-first). */
export const MAX_HISTORY = 100;

interface SeedAgent {
  id: string;
  name: string;
  role: string;
  workstationId: string;
  status: AgentStatus;
  currentTask: string;
  progress: number | null;
  gender?: AgentGender;
}

/** The 8 simulated agents. Everything they produce is `source: 'demo'`. */
export const DEMO_SEEDS: SeedAgent[] = [
  { id: 'nika', name: 'Nika', role: 'Personal Assistant', workstationId: 'ws-01', status: 'idle', currentTask: 'Standing by for instructions', progress: null },
  { id: 'research', name: 'Research Agent', role: 'Research', workstationId: 'ws-02', status: 'working', currentTask: 'Compiling the morning research brief', progress: 45 },
  { id: 'coding', name: 'Coding Agent', role: 'Software Engineering', workstationId: 'ws-03', status: 'working', currentTask: 'Implementing the websocket hub', progress: 60 },
  { id: 'writing', name: 'Writing Agent', role: 'Content Writing', workstationId: 'ws-04', status: 'thinking', currentTask: 'Outlining the launch announcement', progress: null },
  { id: 'design', name: 'Design Agent', role: 'Product Design', workstationId: 'ws-05', status: 'idle', currentTask: 'Waiting for feedback on dashboard mockups', progress: null },
  { id: 'data', name: 'Data Analyst', role: 'Data Analysis', workstationId: 'ws-06', status: 'working', currentTask: 'Running the weekly metrics pipeline', progress: 30 },
  { id: 'automation', name: 'Automation Agent', role: 'Workflow Automation', workstationId: 'ws-07', status: 'waiting', currentTask: 'Paused: awaiting API credentials', progress: null },
  { id: 'monitoring', name: 'Monitoring Agent', role: 'Fleet Monitoring', workstationId: 'ws-08', status: 'working', currentTask: 'Watching fleet health dashboards', progress: null },
];

export interface UpsertResult {
  agent: AgentInfo;
  /** The activity entry appended by this event, or null (e.g. heartbeats). */
  entry: ActivityEntry | null;
}

/**
 * The founder live agents — always seeded on boot. They are NOT a closed
 * list: any authenticated report auto-registers further live seats (see
 * upsertFromEvent). Nayla is Customer Service at the reception desk;
 * Difia is the Project Manager in the Project Room; Kirana writes; Reno
 * codes. All are played by the same assistant (coordinator + one subagent
 * per seat). NOTE: seedLiveAgents never overwrites an existing seat, so
 * a live seat restored from a pre-swap snapshot keeps its old identity
 * until it is updated by an authenticated report (vao.py register) —
 * the seeds only describe the roster for a fresh boot.
 */
export const LIVE_SEEDS: SeedAgent[] = [
  { id: 'nayla', name: 'Nayla', role: 'Customer Service', workstationId: 'reception', status: 'idle', currentTask: 'Standing by at the reception desk', progress: null, gender: 'female' },
  { id: 'difia', name: 'Difia', role: 'Project Manager', workstationId: 'project', status: 'idle', currentTask: 'Standing by in the Project Room', progress: null, gender: 'female' },
  { id: 'kirana', name: 'Kirana', role: 'Writer', workstationId: 'ws-01', status: 'idle', currentTask: 'Standing by for writing work', progress: null, gender: 'female' },
  { id: 'reno', name: 'Reno', role: 'Software Engineering', workstationId: 'ws-02', status: 'idle', currentTask: 'Standing by for coding work', progress: null, gender: 'male' },
];

const LIVE_SEED_MAP = new Map(LIVE_SEEDS.map((s) => [s.id, s]));

/**
 * Normalize an agent id for routing and storage: trim + lowercase. Agent
 * ids are case-insensitive slugs; without this, 'Tara', 'tara' and
 * ' tara ' would register as three different seats. Applied at the route
 * layer (room.ts) before any registry call.
 */
export function normalizeAgentId(agentId: string): string {
  return agentId.trim().toLowerCase();
}

/**
 * Safe seat-id pattern, checked AFTER normalizeAgentId at every route
 * that can create a seat (REST handlePostEvent, WS heartbeat). A
 * normalized id must start with a letter and contain only [a-z0-9_-],
 * 1..50 chars. This is what stops a junk seat like `--help` (born when
 * a CLI flag was passed as a seat id, 2026-10-27) from ever being
 * created: flags, spaces, and symbols fail here, before upsertFromEvent.
 * The founder seats (nayla, difia, kirana, reno) all match this pattern.
 */
export function isValidAgentId(agentId: string): boolean {
  return /^[a-z][a-z0-9_-]{0,49}$/.test(agentId);
}

/** Serializable snapshot of the registry for Durable Object storage. */
export interface RegistrySnapshot {
  agents: AgentInfo[];
  entryCounter: number;
  tasks?: AgentTask[];
  taskCounter?: number;
  siteConfig?: SiteConfig;
  guestThreads?: GuestThread[];
  guestCounter?: number;
  /**
   * Last guest-message timestamp per thread (ms), for the privacy-safe
   * presence signal. Missing in old snapshots = derived from thread
   * messages on restore (see restore()).
   */
  guestLastMessageAt?: Record<string, number>;
  /**
   * Receptionist API key stored server-side only (admin-panel managed).
   * Deliberately NOT part of SiteConfigSchema: GET /api/config is public
   * and must never return this value. Missing in old snapshots = empty.
   */
  receptionistApiKey?: string;
}

/** Cooldown between two guest messages in the same thread (ms). */
export const GUEST_CHAT_COOLDOWN_MS = 15_000;

/** Window in which a guest message counts as "recent" for presence (ms). */
export const GUEST_PRESENCE_WINDOW_MS = 5 * 60_000;

export class AgentRegistry {
  private readonly agents = new Map<string, AgentInfo>();
  private entryCounter = 0;
  private readonly tasks = new Map<string, AgentTask>();
  private taskCounter = 0;
  private siteConfig: SiteConfig = { ...DEFAULT_SITE_CONFIG };
  private siteConfigFromStorage = false;
  /** Receptionist API key (admin-panel managed, server-side only). */
  private receptionistApiKey = '';
  private readonly guestThreads = new Map<string, GuestThread>();
  private guestCounter = 0;
  /** Last guest-message timestamp per thread (ms) — presence signal only. */
  private readonly guestLastMessageAt = new Map<string, number>();
  /** Monotonic clock for guest-chat timestamps (same-ms posts must still order). */
  private lastGuestAt = 0;

  /** Strictly increasing ms timestamp for guest messages/threads. */
  private nextGuestAt(): number {
    const now = Date.now();
    this.lastGuestAt = Math.max(now, this.lastGuestAt + 1);
    return this.lastGuestAt;
  }

  /** Restore from a previously persisted snapshot. */
  restore(snapshot: RegistrySnapshot): void {
    this.agents.clear();
    for (const agent of snapshot.agents) {
      this.agents.set(agent.id, { ...agent, activityHistory: [...agent.activityHistory] });
    }
    this.entryCounter = snapshot.entryCounter;
    this.tasks.clear();
    for (const task of snapshot.tasks ?? []) {
      this.tasks.set(task.id, { ...task });
    }
    this.taskCounter = snapshot.taskCounter ?? 0;
    if (snapshot.siteConfig) {
      this.siteConfig = { ...DEFAULT_SITE_CONFIG, ...snapshot.siteConfig };
      this.siteConfigFromStorage = true;
    } else {
      this.siteConfig = { ...DEFAULT_SITE_CONFIG };
      this.siteConfigFromStorage = false;
    }
    this.guestThreads.clear();
    this.guestLastMessageAt.clear();
    for (const thread of snapshot.guestThreads ?? []) {
      this.guestThreads.set(thread.guestId, {
        ...thread,
        messages: thread.messages.map((m) => ({ ...m })),
      });
    }
    if (snapshot.guestLastMessageAt) {
      for (const [gid, at] of Object.entries(snapshot.guestLastMessageAt)) {
        this.guestLastMessageAt.set(gid, at);
      }
    } else {
      // Snapshots predating presence tracking: backfill from the threads'
      // own last guest messages so the signal still works after restore.
      for (const thread of this.guestThreads.values()) {
        const lastGuest = [...thread.messages]
          .reverse()
          .find((m) => m.from === 'guest');
        if (lastGuest) this.guestLastMessageAt.set(thread.guestId, lastGuest.at);
      }
    }
    this.guestCounter = snapshot.guestCounter ?? 0;
    // Missing in snapshots predating admin-panel key management = empty.
    this.receptionistApiKey = snapshot.receptionistApiKey ?? '';
  }

  snapshot(): RegistrySnapshot {
    return {
      agents: [...this.agents.values()].map((a) => ({ ...a, activityHistory: [...a.activityHistory] })),
      entryCounter: this.entryCounter,
      tasks: [...this.tasks.values()].map((t) => ({ ...t })),
      taskCounter: this.taskCounter,
      siteConfig: { ...this.siteConfig },
      guestThreads: [...this.guestThreads.values()].map((t) => ({
        ...t,
        messages: t.messages.map((m) => ({ ...m })),
      })),
      guestCounter: this.guestCounter,
      guestLastMessageAt: Object.fromEntries(this.guestLastMessageAt),
      receptionistApiKey: this.receptionistApiKey,
    };
  }

  /** Whether a receptionist API key is stored (never reveals the value). */
  hasReceptionistApiKey(): boolean {
    return this.receptionistApiKey !== '';
  }

  /**
   * Server-side-only accessor for the stored key. Callers must never put
   * this value into any response (GET /api/config returns getSiteConfig(),
   * which structurally cannot contain it).
   */
  getReceptionistApiKey(): string {
    return this.receptionistApiKey;
  }

  /** Store (or clear, with '') the receptionist API key. Returns hasKey. */
  setReceptionistApiKey(key: string): boolean {
    this.receptionistApiKey = key;
    return this.hasReceptionistApiKey();
  }

  /** Current runtime site settings (a copy — mutate via setSiteConfig). */
  getSiteConfig(): SiteConfig {
    return { ...this.siteConfig };
  }

  /** Replace the runtime site settings; returns the stored copy. */
  setSiteConfig(config: SiteConfig): SiteConfig {
    this.siteConfig = { ...config };
    this.siteConfigFromStorage = true;
    return this.getSiteConfig();
  }

  /**
   * Seed the offline timeout from the env var on a fresh deployment that
   * has no stored config yet. Returns true when it changed anything.
   * Once a config has been saved, the stored value wins over the env var.
   */
  ensureSiteConfig(fallbackTimeoutMs: number): boolean {
    if (this.siteConfigFromStorage) return false;
    this.siteConfig = { ...DEFAULT_SITE_CONFIG, offlineTimeoutMs: fallbackTimeoutMs };
    this.siteConfigFromStorage = true;
    return true;
  }

  /**
   * Seed the founder live agents (idempotent — never overwrites existing agents).
   * Live agents are always labeled `source: 'live'`. Founder seats created
   * before gender existed get their seed gender backfilled, but only
   * when no gender was ever reported (an explicitly reported gender is
   * never overwritten by the seed).
   */
  seedLiveAgents(): number {
    const now = new Date().toISOString();
    let added = 0;
    for (const seed of LIVE_SEEDS) {
      const existing = this.agents.get(seed.id);
      if (existing) {
        if (seed.gender && existing.gender === undefined) {
          existing.gender = seed.gender;
        }
        continue;
      }
      const agent: AgentInfo = {
        id: seed.id,
        name: seed.name,
        role: seed.role,
        status: seed.status,
        currentTask: seed.currentTask,
        progress: seed.progress,
        lastSeen: now,
        workstationId: seed.workstationId,
        activityHistory: [],
        source: 'live',
        ...(seed.gender ? { gender: seed.gender } : {}),
      };
      agent.activityHistory.push(this.makeEntry(seed.id, 'system', 'Live agent seat created', now));
      this.agents.set(seed.id, agent);
      added += 1;
    }
    return added;
  }

  /**
   * Remove every `source: 'demo'` agent. Enforces "no demo" when demo mode
   * is off, including state persisted from an earlier demo deployment.
   */
  purgeDemoAgents(): number {
    let removed = 0;
    for (const [id, agent] of this.agents) {
      if (agent.source === 'demo') {
        this.agents.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  /**
   * Remove one seat by id, including its queued tasks. Returns true when
   * a seat was removed, false when the id was unknown (the DELETE route
   * maps false to 404). No founder exception by design: the operator
   * decides which seats live or die, including nayla/difia/kirana/reno. The
   * caller must persist afterwards so the removal survives restarts.
   */
  removeAgent(id: string): boolean {
    const removed = this.agents.delete(id);
    if (!removed) return false;
    for (const [taskId, task] of this.tasks) {
      if (task.agentId === id) this.tasks.delete(taskId);
    }
    return true;
  }

  /**
   * Seed the 8 demo agents (idempotent — never overwrites existing agents).
   * Demo agents are always labeled `source: 'demo'`.
   */
  seedDemoAgents(): void {
    const now = new Date().toISOString();
    for (const seed of DEMO_SEEDS) {
      if (this.agents.has(seed.id)) continue;
      const agent: AgentInfo = {
        id: seed.id,
        name: seed.name,
        role: seed.role,
        status: seed.status,
        currentTask: seed.currentTask,
        progress: seed.progress,
        lastSeen: now,
        workstationId: seed.workstationId,
        activityHistory: [],
        source: 'demo',
      };
      agent.activityHistory.push(this.makeEntry(seed.id, 'system', 'Demo agent initialized', now));
      this.agents.set(seed.id, agent);
    }
  }

  list(): AgentInfo[] {
    return [...this.agents.values()];
  }

  get(id: string): AgentInfo | undefined {
    return this.agents.get(id);
  }

  recentEvents(agentId: string, limit: number): ActivityEntry[] | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;
    return agent.activityHistory.slice(0, Math.max(0, limit));
  }

  /**
   * Apply a validated event to an agent, dynamically registering the
   * agent as a live seat when unknown. A report may declare identity
   * (name/role/workstationId/gender): used at creation and applied as an
   * update on later reports. Defaults for undeclared identity: name = id,
   * role `'External Agent'`, workstation `'ws-remote'` (the frontend
   * renders unknown workstations in the lobby grid, so no new desk is
   * invented), gender unknown (frontend legacy fallback). Founder seats
   * keep their seed identity unless a report overrides it. Source never
   * changes on update, so demo agents can never be promoted to live by
   * reporting.
   */
  upsertFromEvent(agentId: string, event: EventPost): UpsertResult {
    const now = new Date().toISOString();
    let agent = this.agents.get(agentId);
    // Identity declared by the report (trimmed; blank = not declared).
    const name = event.name?.trim() || undefined;
    const role = event.role?.trim() || undefined;
    const workstationId = event.workstationId?.trim() || undefined;
    const gender = event.gender;
    if (!agent) {
      // Dynamic registration: any authenticated report auto-creates a
      // live seat. The seat is 'live', never demo, and survives
      // snapshot/restore like any other live seat.
      const seed = LIVE_SEED_MAP.get(agentId);
      agent = {
        id: agentId,
        name: name ?? seed?.name ?? agentId,
        role: role ?? seed?.role ?? 'External Agent',
        status: seed?.status ?? 'idle',
        currentTask: seed?.currentTask ?? '',
        progress: seed?.progress ?? null,
        lastSeen: now,
        workstationId: workstationId ?? seed?.workstationId ?? 'ws-remote',
        activityHistory: [],
        source: 'live',
        ...(gender ?? seed?.gender ? { gender: gender ?? seed?.gender } : {}),
      };
      this.agents.set(agentId, agent);
    } else if (name || role || workstationId || gender) {
      // Identity updates from later authenticated reports. A gender
      // that is not sent leaves the stored gender untouched.
      if (name) agent.name = name;
      if (role) agent.role = role;
      if (workstationId) agent.workstationId = workstationId;
      if (gender) agent.gender = gender;
    }

    let entry: ActivityEntry | null = null;
    switch (event.type) {
      case 'status': {
        const next = event.status;
        if (next && next !== agent.status) {
          agent.status = next;
          entry = this.makeEntry(agentId, 'status', event.message ?? `Status changed to "${next}"`, event.timestamp);
        } else if (event.message) {
          entry = this.makeEntry(agentId, 'status', event.message, event.timestamp);
        }
        break;
      }
      case 'task': {
        if (event.task) agent.currentTask = event.task;
        if (event.progress !== undefined) agent.progress = event.progress;
        // A reporting agent is alive: revive it from idle/offline into working.
        if (agent.status === 'idle' || agent.status === 'offline') {
          agent.status = 'working';
        }
        entry = this.makeEntry(agentId, 'task', event.message ?? `Task updated: ${agent.currentTask}`, event.timestamp);
        break;
      }
      case 'event': {
        entry = this.makeEntry(agentId, event.kind ?? 'note', event.message ?? '', event.timestamp);
        break;
      }
      case 'heartbeat': {
        // A heartbeat from an agent previously marked offline revives it.
        if (agent.status === 'offline') {
          agent.status = 'idle';
          entry = this.makeEntry(agentId, 'system', 'Agent back online', event.timestamp);
        }
        break;
      }
    }

    agent.lastSeen = now;
    if (entry) this.appendEntry(agent, entry);
    return { agent, entry };
  }

  /**
   * Task queue (office → agent). Tasks are commands, not execution: the
   * registry only stores them until the agent's poller claims them.
   */
  createTask(agentId: string, title: string, detail?: string): AgentTask {
    const now = new Date().toISOString();
    this.taskCounter += 1;
    const task: AgentTask = {
      id: `${Date.now()}-${this.taskCounter}`,
      agentId,
      title,
      detail,
      status: 'pending',
      createdAt: now,
      completedAt: null,
    };
    this.tasks.set(task.id, task);
    return { ...task };
  }

  listTasks(agentId: string, status?: 'pending' | 'done'): AgentTask[] {
    return [...this.tasks.values()]
      .filter((t) => t.agentId === agentId && (status === undefined || t.status === status))
      .map((t) => ({ ...t }));
  }

  /** Mark a task done (idempotent); null when the task is unknown or foreign. */
  completeTask(agentId: string, taskId: string): AgentTask | null {
    const task = this.tasks.get(taskId);
    if (!task || task.agentId !== agentId) return null;
    if (task.status === 'done') return { ...task };
    task.status = 'done';
    task.completedAt = new Date().toISOString();
    const agent = this.agents.get(agentId);
    if (agent) {
      this.appendEntry(agent, this.makeEntry(agentId, 'task', `Task completed: ${task.title}`));
    }
    return { ...task };
  }

  /**
   * Guest chat (visitor → Nayla). Threads are keyed by the client-generated
   * guestId; a visitor can only ever read their own thread (enforced by
   * the route handler passing their guestId back). Replies from Nayla (the
   * assistant, via the poller) or from an admin append to the same thread.
   * Pre-swap threads may still carry 'difia' replies (see schemas.ts).
   */
  postGuestMessage(
    guestId: string,
    guestName: string | undefined,
    text: string,
  ): { message: GuestChatMessage; thread: GuestThread } | { cooldownMs: number } {
    const now = this.nextGuestAt();
    const existing = this.guestThreads.get(guestId);
    if (existing) {
      const lastGuest = [...existing.messages].reverse().find((m) => m.from === 'guest');
      if (lastGuest && now - lastGuest.at < GUEST_CHAT_COOLDOWN_MS) {
        return { cooldownMs: GUEST_CHAT_COOLDOWN_MS - (now - lastGuest.at) };
      }
    }
    this.guestCounter += 1;
    const message: GuestChatMessage = {
      id: `${now}-${this.guestCounter}`,
      guestId,
      guestName: guestName?.trim() ? guestName.trim() : (existing?.guestName ?? 'Tamu'),
      from: 'guest',
      text,
      at: now,
    };
    const thread: GuestThread = existing ?? {
      guestId,
      guestName: message.guestName,
      messages: [],
      updatedAt: now,
    };
    if (guestName?.trim()) thread.guestName = guestName.trim();
    thread.messages.push(message);
    thread.updatedAt = now;
    this.guestThreads.set(guestId, thread);
    this.guestLastMessageAt.set(guestId, now);
    return { message: { ...message }, thread: this.copyThread(thread) };
  }

  /** A copy of one guest's thread, or undefined when they never wrote. */
  getGuestThread(guestId: string): GuestThread | undefined {
    const thread = this.guestThreads.get(guestId);
    return thread ? this.copyThread(thread) : undefined;
  }

  /** All threads, newest-updated first (admin + poller views only). */
  listGuestThreads(): GuestThread[] {
    return [...this.guestThreads.values()]
      .map((t) => this.copyThread(t))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Guest messages that have no Nayla/admin reply after them, with the
   * thread owner attached — this is what the poller answers.
   */
  pendingGuestMessages(): Array<{ guestId: string; guestName: string; message: GuestChatMessage }> {
    const out: Array<{ guestId: string; guestName: string; message: GuestChatMessage }> = [];
    for (const thread of this.guestThreads.values()) {
      let lastReplyIdx = -1;
      thread.messages.forEach((m, i) => {
        if (m.from !== 'guest') lastReplyIdx = i;
      });
      thread.messages.forEach((m, i) => {
        if (m.from === 'guest' && i > lastReplyIdx) {
          out.push({ guestId: thread.guestId, guestName: thread.guestName, message: { ...m } });
        }
      });
    }
    return out.sort((a, b) => a.message.at - b.message.at);
  }

  /**
   * Count of unanswered guest messages, as a bare number. This is the
   * ONLY value the public /api/guest-chat/pending-count endpoint
   * returns — no message content, guestIds, or guest names ever leave
   * through that route, so it is safe to call without auth.
   */
  pendingGuestCount(): number {
    return this.pendingGuestMessages().length;
  }

  /**
   * Privacy-safe guest presence for the reception standby signal. True
   * when any thread has a guest message within GUEST_PRESENCE_WINDOW_MS
   * or has an unanswered guest message. Returns a bare boolean only —
   * never message content, guestIds, or guest names.
   */
  isGuestActive(now: number = Date.now()): boolean {
    if (this.pendingGuestMessages().length > 0) return true;
    for (const at of this.guestLastMessageAt.values()) {
      if (now - at < GUEST_PRESENCE_WINDOW_MS) return true;
    }
    return false;
  }

  /**
   * Public briefing signal (privacy-safe, same shape as presence): true
   * exactly when Difia the Project Manager has a pending task whose
   * title starts with "Guest request:" — the marker the poller bridge
   * uses when it turns a completed guest order into a PM task. The
   * dashboard reads ONLY this boolean: no guest ids, names, message
   * text, or task titles ever leave through it, so a guest-order
   * briefing can start in the scene without leaking guest content to
   * a public endpoint.
   */
  isBriefingActive(): boolean {
    return this.listTasks('difia', 'pending').some((t) =>
      t.title.startsWith('Guest request:'),
    );
  }

  /** True when the message exists in any thread. */
  guestMessageExists(messageId: string): boolean {
    for (const thread of this.guestThreads.values()) {
      if (thread.messages.some((m) => m.id === messageId)) return true;
    }
    return false;
  }

  /**
   * Append a Nayla/admin reply to the thread owning the message.
   * Returns null for an unknown message AND for a second reply to the
   * same messageId from the SAME from-value (nayla/admin separately) —
   * this is the double-reply guard that stops the AI endpoint and the
   * poller ever answering one message twice. A follow-up from a
   * DIFFERENT from-value is still allowed.
   */
  replyToGuestMessage(
    messageId: string,
    from: 'nayla' | 'admin',
    text: string,
  ): { thread: GuestThread; reply: GuestChatMessage } | null {
    for (const thread of this.guestThreads.values()) {
      const idx = thread.messages.findIndex((m) => m.id === messageId);
      if (idx === -1) continue;
      if (thread.messages.slice(idx + 1).some((m) => m.from === from)) return null;
      const now = this.nextGuestAt();
      this.guestCounter += 1;
      const reply: GuestChatMessage = {
        id: `${now}-${this.guestCounter}`,
        guestId: thread.guestId,
        guestName: from === 'nayla' ? 'Nayla' : 'Admin',
        from,
        text,
        at: now,
      };
      thread.messages.push(reply);
      thread.updatedAt = now;
      return { thread: this.copyThread(thread), reply: { ...reply } };
    }
    return null;
  }

  /**
   * Append a Nayla follow-up to a thread by guestId, regardless of
   * whether earlier messages were already answered. This is the
   * separate follow-up path — it deliberately does NOT go through
   * replyToGuestMessage's double-reply guard, which must stay intact
   * for normal replies: a correction or a final delivery (e.g. a
   * summary) has to reach a thread whose every guest message already
   * has a Nayla reply. Existing messages are never modified or
   * deleted. Returns null for an unknown guestId.
   */
  appendGuestFollowup(
    guestId: string,
    text: string,
  ): { thread: GuestThread; followup: GuestChatMessage } | null {
    const thread = this.guestThreads.get(guestId);
    if (!thread) return null;
    const now = this.nextGuestAt();
    this.guestCounter += 1;
    const followup: GuestChatMessage = {
      id: `${now}-${this.guestCounter}`,
      guestId: thread.guestId,
      guestName: 'Nayla',
      from: 'nayla',
      text,
      at: now,
    };
    thread.messages.push(followup);
    thread.updatedAt = now;
    return { thread: this.copyThread(thread), followup: { ...followup } };
  }

  private copyThread(thread: GuestThread): GuestThread {
    return { ...thread, messages: thread.messages.map((m) => ({ ...m })) };
  }

  /**
   * Mark agents as offline when they have been silent longer than `timeoutMs`.
   * Appends a `system` entry to each affected agent and returns them.
   */
  markOfflineSweep(timeoutMs: number): AgentInfo[] {
    const nowMs = Date.now();
    const changed: AgentInfo[] = [];
    for (const agent of this.agents.values()) {
      if (agent.status === 'offline') continue;
      const lastSeenMs = Date.parse(agent.lastSeen);
      if (Number.isNaN(lastSeenMs)) continue;
      if (nowMs - lastSeenMs > timeoutMs) {
        agent.status = 'offline';
        const idleSec = Math.round((nowMs - lastSeenMs) / 1000);
        this.appendEntry(
          agent,
          this.makeEntry(agent.id, 'system', `Marked offline after ${idleSec}s without activity`),
        );
        changed.push(agent);
      }
    }
    return changed;
  }

  private makeEntry(agentId: string, kind: ActivityKind, message: string, timestamp?: string): ActivityEntry {
    this.entryCounter += 1;
    return {
      id: `${Date.now()}-${this.entryCounter}`,
      agentId,
      timestamp: timestamp ?? new Date().toISOString(),
      kind,
      message,
    };
  }

  private appendEntry(agent: AgentInfo, entry: ActivityEntry): void {
    agent.activityHistory.unshift(entry);
    if (agent.activityHistory.length > MAX_HISTORY) {
      agent.activityHistory.length = MAX_HISTORY;
    }
  }
}
