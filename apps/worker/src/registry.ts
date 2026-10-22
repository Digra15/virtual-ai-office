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
  AgentInfo,
  AgentStatus,
  EventPost,
} from '@virtual-ai-office/shared';

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

/** Serializable snapshot of the registry for Durable Object storage. */
export interface RegistrySnapshot {
  agents: AgentInfo[];
  entryCounter: number;
}

export class AgentRegistry {
  private readonly agents = new Map<string, AgentInfo>();
  private entryCounter = 0;

  /** Restore from a previously persisted snapshot. */
  restore(snapshot: RegistrySnapshot): void {
    this.agents.clear();
    for (const agent of snapshot.agents) {
      this.agents.set(agent.id, { ...agent, activityHistory: [...agent.activityHistory] });
    }
    this.entryCounter = snapshot.entryCounter;
  }

  snapshot(): RegistrySnapshot {
    return {
      agents: [...this.agents.values()].map((a) => ({ ...a, activityHistory: [...a.activityHistory] })),
      entryCounter: this.entryCounter,
    };
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
   * Apply a validated event to an agent, creating the agent when unknown.
   *
   * Unknown agents are created as `source: 'live'` with `name` defaulting to
   * the id, role `'External Agent'` and workstation `'ws-remote'`.
   */
  upsertFromEvent(agentId: string, event: EventPost): UpsertResult {
    const now = new Date().toISOString();
    let agent = this.agents.get(agentId);
    if (!agent) {
      agent = {
        id: agentId,
        name: agentId,
        role: 'External Agent',
        status: 'idle',
        currentTask: '',
        progress: null,
        lastSeen: now,
        workstationId: 'ws-remote',
        activityHistory: [],
        source: 'live',
      };
      this.agents.set(agentId, agent);
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
