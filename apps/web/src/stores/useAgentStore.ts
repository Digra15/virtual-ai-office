import { create } from "zustand";
import type {
  ActivityEntry,
  AgentInfo,
  AgentStatus,
} from "@virtual-ai-office/shared";

export interface AgentStats {
  total: number;
  online: number;
  working: number;
  errors: number;
}

export type StatusFilter = AgentStatus | "all";

interface AgentState {
  agents: Record<string, AgentInfo>;
  selectedId: string | null;
  /** Newest-first, capped at MAX_EVENTS. */
  globalEvents: ActivityEntry[];
  applySnapshot: (agents: AgentInfo[]) => void;
  applyUpdate: (agent: AgentInfo) => void;
  appendEvent: (agentId: string, entry: ActivityEntry) => void;
  select: (id: string | null) => void;
  /** Insert or replace an agent (used for local/stress-mode extras). */
  upsertLocal: (agent: AgentInfo) => void;
  removeLocal: (id: string) => void;
  selectStats: () => AgentStats;
  selectFiltered: (search: string, statusFilter: StatusFilter) => AgentInfo[];
}

const MAX_EVENTS = 100;

export const useAgentStore = create<AgentState>()((set, get) => ({
  agents: {},
  selectedId: null,
  globalEvents: [],

  applySnapshot: (agents) =>
    set({
      agents: Object.fromEntries(agents.map((a) => [a.id, a])),
      selectedId: null,
    }),

  applyUpdate: (agent) =>
    set((s) => ({ agents: { ...s.agents, [agent.id]: agent } })),

  appendEvent: (agentId, entry) =>
    set((s) => {
      const prev = s.agents[agentId];
      const agents = prev
        ? {
            ...s.agents,
            [agentId]: {
              ...prev,
              activityHistory: [entry, ...prev.activityHistory],
            },
          }
        : s.agents;
      return {
        agents,
        globalEvents: [entry, ...s.globalEvents].slice(0, MAX_EVENTS),
      };
    }),

  select: (id) => set({ selectedId: id }),

  upsertLocal: (agent) =>
    set((s) => ({ agents: { ...s.agents, [agent.id]: agent } })),

  removeLocal: (id) =>
    set((s) => {
      if (!(id in s.agents)) return s;
      const agents = { ...s.agents };
      delete agents[id];
      return {
        agents,
        selectedId: s.selectedId === id ? null : s.selectedId,
      };
    }),

  selectStats: () => {
    const list = Object.values(get().agents);
    return {
      total: list.length,
      online: list.filter((a) => a.status !== "offline").length,
      working: list.filter((a) => a.status === "working").length,
      errors: list.filter((a) => a.status === "error").length,
    };
  },

  selectFiltered: (search, statusFilter) => {
    const q = search.trim().toLowerCase();
    return Object.values(get().agents)
      .filter((a) => statusFilter === "all" || a.status === statusFilter)
      .filter(
        (a) =>
          q === "" ||
          a.name.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          (a.currentTask ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  },
}));
