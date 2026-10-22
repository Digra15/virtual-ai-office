import { create } from "zustand";

/**
 * Per-agent locomotion presence (client-side only).
 *
 * This store holds DISCRETE activity transitions (seated → walking →
 * meeting …). It is the React-readable mirror of the imperative
 * `world/movement.ts` registry, which owns the per-frame positions.
 * Components subscribe to a single agent's presence, so a transition
 * re-renders only that agent's avatar — never the whole scene, and never
 * per frame.
 */

/** What the agent is doing with its body right now. */
export type AgentActivity = "seated" | "walking" | "meeting" | "standing";

/**
 * How the figure is mounted on its scene-graph root:
 * - "desk": seated at a desk (figure offset toward the chair, facing monitor)
 * - "free": standing or sitting freely (figure centered on the root)
 */
export type AgentPose = "desk" | "free";

export interface PresenceInfo {
  activity: AgentActivity;
  pose: AgentPose;
}

export const DEFAULT_PRESENCE: PresenceInfo = {
  activity: "seated",
  pose: "desk",
};

interface PresenceState {
  presences: Record<string, PresenceInfo>;
  setPresence: (agentId: string, patch: Partial<PresenceInfo>) => void;
  resetPresence: (agentId: string) => void;
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  presences: {},

  setPresence: (agentId, patch) =>
    set((s) => ({
      presences: {
        ...s.presences,
        [agentId]: { ...(s.presences[agentId] ?? DEFAULT_PRESENCE), ...patch },
      },
    })),

  resetPresence: (agentId) =>
    set((s) => {
      if (!(agentId in s.presences)) return s;
      const presences = { ...s.presences };
      delete presences[agentId];
      return { presences };
    }),
}));
