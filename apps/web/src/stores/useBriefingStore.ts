import { create } from "zustand";

/**
 * Project Room briefing state (dashboard scene only, client-side).
 *
 * A briefing is a short face-to-face in the Project Room: one visitor
 * (Nayla reporting an order, or a worker receiving an instruction) sits
 * in a guest chair opposite Difia the Project Manager in the boss chair.
 * The dialogue strip shows REAL text only — a task title/detail entered
 * by a human, or nothing at all (then the strip shows "..." with no
 * invented line). Never simulated dialogue, never a meeting transcript:
 * the meeting system (MeetingRoom chairs + SIMULATED transcripts) is a
 * different feature and is deliberately NOT reused here.
 *
 * How a briefing starts (honest trigger, see BriefingDirector):
 * - Same-session Kanban: a task newly added to useTaskStore while the
 *   dashboard scene is mounted, with an assignee other than Difia, is
 *   a PM instruction briefing for that assignee.
 * - Guest-order signal: when the Worker briefing boolean is true
 *   (Difia has a pending "Guest request:" task, created by the poller
 *   bridge from a completed guest thread) AND the guest is quiet,
 *   Nayla reports to Difia in the Project Room. The signal carries no
 *   guest content, so a report briefing's strip shows only the
 *   generic caption — its text field stays empty by design.
 * - Programmatic: startBriefing(visitorId, text, kind) — still
 *   available for other callers. The dashboard never reads guest
 *   threads itself (no bearer secret in the browser) and Worker task
 *   creation broadcasts nothing to the scene, so a briefing can only
 *   start from the Kanban trigger, the briefing boolean, or this call.
 */
export type BriefingKind = "report" | "instruction";

export interface Briefing {
  /** Unique id (task id for Kanban briefings, otherwise generated). */
  id: string;
  /** Agent who walks to the guest chair. */
  visitorId: string;
  /** REAL text for the dialogue strip (task title/detail), or "". */
  text: string;
  kind: BriefingKind;
}

interface BriefingState {
  /** Active briefing, or null when nobody is briefing. */
  briefing: Briefing | null;
  /** Current speaker while the talking phase runs, or null. */
  speakerId: string | null;
  startBriefing: (briefing: Briefing) => void;
  setSpeaker: (speakerId: string | null) => void;
  endBriefing: () => void;
}

export const useBriefingStore = create<BriefingState>()((set) => ({
  briefing: null,
  speakerId: null,
  startBriefing: (briefing) => set({ briefing, speakerId: null }),
  setSpeaker: (speakerId) => set({ speakerId }),
  endBriefing: () => set({ briefing: null, speakerId: null }),
}));

/** True when the agent is a participant of the active briefing. */
export function isInBriefing(agentId: string): boolean {
  const b = useBriefingStore.getState().briefing;
  return b !== null && (b.visitorId === agentId || agentId === "difia");
}
