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
 * - Programmatic: startBriefing(visitorId, text, kind) — the entry point
 *   the future poller bridge will call when a guest order becomes a PM
 *   task. There is NO automatic guest-order trigger today: guest threads
 *   live in the Worker, the dashboard does not poll them, and task
 *   creation in the Worker broadcasts nothing to the scene — so the
 *   director must not pretend a guest chat started a briefing.
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
