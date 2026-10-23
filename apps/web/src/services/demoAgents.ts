import type {
  ActivityEntry,
  ActivityKind,
  AgentInfo,
  AgentSource,
  AgentStatus,
} from "@virtual-ai-office/shared";

/**
 * Local demo data used when the backend WebSocket is unreachable.
 * Mirrors the backend's demo seed roster (same ids, names, roles, desks).
 */

// The exact `ActivityKind` union members live in @virtual-ai-office/shared
// (built by the backend track). The wire format is plain strings, so we cast
// through `unknown` to stay decoupled from the union's member list.
const kind = (k: string): ActivityKind => k as unknown as ActivityKind;

const DEMO_SOURCE: AgentSource = "demo";

interface SeedDef {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask: string | null;
  progress: number | null;
  workstationId: string;
  events: Array<[string, string]>; // [kind, message]
}

const SEEDS: SeedDef[] = [
  {
    id: "nika",
    name: "Nika",
    role: "Personal Assistant",
    status: "working",
    currentTask: "Triaging inbox and drafting replies",
    progress: 62,
    workstationId: "ws-01",
    events: [
      ["task", "Started triaging inbox (24 unread)"],
      ["status", "Status changed: idle → working"],
      ["note", "Drafted 6 replies awaiting review"],
    ],
  },
  {
    id: "research",
    name: "Research",
    role: "Research Agent",
    status: "working",
    currentTask: "Surveying vector-database benchmarks",
    progress: 35,
    workstationId: "ws-02",
    events: [
      ["task", "Opened 12 papers on vector-DB benchmarks"],
      ["note", "Extracted latency tables from 4 sources"],
    ],
  },
  {
    id: "coding",
    name: "Coding",
    role: "Coding Agent",
    status: "working",
    currentTask: "Implementing WebSocket reconnection logic",
    progress: 80,
    workstationId: "ws-03",
    events: [
      ["task", "Picked up ticket WS-114: reconnect backoff"],
      ["note", "All unit tests passing (14/14)"],
    ],
  },
  {
    id: "writing",
    name: "Writing",
    role: "Writing Agent",
    status: "thinking",
    currentTask: "Outlining the Q4 launch announcement",
    progress: null,
    workstationId: "ws-04",
    events: [["status", "Status changed: working → thinking"]],
  },
  {
    id: "design",
    name: "Design",
    role: "Design Agent",
    status: "idle",
    currentTask: null,
    progress: null,
    workstationId: "ws-05",
    events: [["note", "Finished dashboard mockups, awaiting feedback"]],
  },
  {
    id: "data",
    name: "Data",
    role: "Data Analyst",
    status: "working",
    currentTask: "Building weekly engagement report",
    progress: 48,
    workstationId: "ws-06",
    events: [
      ["task", "Aggregating engagement metrics for week 42"],
      ["note", "CTR up 3.2% vs last week"],
    ],
  },
  {
    id: "automation",
    name: "Automation",
    role: "Automation Agent",
    status: "waiting",
    currentTask: "Nightly backup pipeline",
    progress: 10,
    workstationId: "ws-07",
    events: [
      ["status", "Status changed: working → waiting"],
      ["note", "Waiting on storage quota approval"],
    ],
  },
  {
    id: "monitoring",
    name: "Monitoring",
    role: "Monitoring Agent",
    status: "error",
    currentTask: "Watching API latency alerts",
    progress: null,
    workstationId: "ws-08",
    events: [
      ["error", "Alert: p99 latency exceeded 800ms on /api/agents"],
      ["note", "Retrying health check (attempt 3)"],
    ],
  },
];

function buildEntries(seed: SeedDef, now: number): ActivityEntry[] {
  return seed.events.map(([k, message], i) => ({
    id: `${seed.id}-demo-${i}`,
    agentId: seed.id,
    // Newest first: event 0 is the most recent.
    timestamp: new Date(now - i * 90_000).toISOString(),
    kind: kind(k),
    message,
  }));
}

/** The 8-agent demo roster, with `lastSeen` set to now. */
export function buildLocalDemoAgents(now: number = Date.now()): AgentInfo[] {
  return SEEDS.map((seed) => ({
    id: seed.id,
    name: seed.name,
    role: seed.role,
    status: seed.status,
    currentTask: seed.currentTask ?? "Awaiting assignment",
    progress: seed.progress,
    lastSeen: new Date(now).toISOString(),
    workstationId: seed.workstationId,
    activityHistory: buildEntries(seed, now),
    source: DEMO_SOURCE,
  }));
}

// ---------------------------------------------------------------------------
// Stress-mode extras: 12 deterministic filler agents for load testing the UI.
// ---------------------------------------------------------------------------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const STRESS_ROLES = [
  "Research Agent",
  "Coding Agent",
  "Writing Agent",
  "QA Agent",
  "Scraper",
  "Summarizer",
  "Scheduler",
  "Notifier",
] as const;

const STRESS_TASKS = [
  "Crawling documentation pages",
  "Running regression test suite",
  "Summarizing discussion threads",
  "Drafting weekly report",
  "Watching job queue depth",
  "Indexing new pages",
  "Syncing cache shards",
  "Probing endpoint health",
] as const;

const STRESS_STATUSES: AgentStatus[] = [
  "working",
  "working",
  "working",
  "thinking",
  "idle",
  "waiting",
  "working",
  "idle",
];

/**
 * Deterministic pseudo-random agents: the same id always yields the same
 * agent, so toggling stress mode on/off is stable and repeatable.
 */
export function buildStressAgents(
  count = 12,
  now: number = Date.now(),
): AgentInfo[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const id = `stress-${String(n).padStart(2, "0")}`;
    const h = hashString(id);
    const status = STRESS_STATUSES[h % STRESS_STATUSES.length];
    const role = STRESS_ROLES[h % STRESS_ROLES.length];
    const task = STRESS_TASKS[(h >> 3) % STRESS_TASKS.length];
    const working = status === "working";
    return {
      id,
      name: `Stress ${String(n).padStart(2, "0")}`,
      role,
      status,
      currentTask:
        status === "idle" || status === "offline" ? "Awaiting assignment" : task,
      progress: working ? h % 100 : null,
      lastSeen: new Date(now - (h % 120_000)).toISOString(),
      // Virtual id: no physical hot desk exists anymore, so the avatar
      // resolves to the lobby-grid fallback in world/layout.ts
      // `AGENT_SPAWN_POSITION`.
      workstationId: id,
      activityHistory: [
        {
          id: `${id}-demo-0`,
          agentId: id,
          timestamp: new Date(now - (h % 60_000)).toISOString(),
          kind: kind("status"),
          message: `Spawned for stress test (${role})`,
        },
      ],
      source: DEMO_SOURCE,
    } satisfies AgentInfo;
  });
}
