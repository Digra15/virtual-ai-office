import { useEffect } from "react";
import { useAgentStore } from "../../stores/useAgentStore";
import { useMeetingStore } from "../../stores/useMeetingStore";
import { usePresenceStore } from "../../stores/usePresenceStore";
import { useTaskStore } from "../../stores/useTaskStore";
import {
  GUEST_PRESENCE_POLL_MS,
  useGuestPresenceStore,
} from "../../stores/useGuestPresenceStore";
import { useBriefingStore, type Briefing } from "../../stores/useBriefingStore";
import { movement } from "../../world/movement";
import {
  AGENT_FACING,
  AGENT_SPAWN_POSITION,
  PM_HOME,
} from "../../world/layout";
import { cancelWanderFor } from "../wander/WanderDirector";

/**
 * Project Room briefing director (dashboard scene only).
 *
 * A briefing is Difia the Project Manager sitting in the boss chair
 * (-11.5, 4.8, facing south) while one visitor sits in a guest chair
 * facing north and the two "talk": the visitor's speech bubble pulses
 * "...", the listener nods, and the bottom dialogue strip shows the
 * REAL instruction text (a task title/detail entered by a human) — or
 * just "..." when no real text exists. No simulated dialogue, no
 * meeting transcript: the meeting system (MeetingRoom chairs +
 * SIMULATED transcripts) is deliberately NOT reused here.
 *
 * TRIGGER (honest, and its limit): this director watches useTaskStore
 * for a task ADDED AFTER it mounts, assigned to someone other than
 * Difia. That is the same-session Kanban assignment a PM makes while
 * the dashboard scene is open. It ALSO watches the Worker briefing
 * signal (useGuestPresenceStore.briefingActive, polled every 30 s
 * like presence, dashboard only): when that boolean is true AND the
 * guest is quiet (guestActive false), Nayla walks to the Project Room
 * to report a guest order to Difia. Nayla must never abandon an
 * active conversation — she finishes the chat first, and guestActive
 * only clears 5 minutes after the last guest message, so a report
 * briefing always waits for quiet.
 *
 * PRIVACY RULE for guest-order briefings: the briefing signal carries
 * NO guest content (no ids, names, message text, or task titles), so
 * the dialogue strip for a report briefing shows ONLY the generic
 * caption "Membahas pesanan tamu" — never guest message text, never
 * a task title derived from guest content. The specific instruction
 * stays in the Difia PM task, which only the office side reads.
 * (Kanban instruction briefings are different: their strip text is
 * the human-entered task title, which is already office-side data.)
 *
 * What this director does NOT do: it does not read guest threads
 * (the dashboard has no bearer secret and must never fetch them),
 * and it does not create PM tasks. The poller bridge is what turns a
 * completed guest thread into a "Guest request:" PM task; this
 * director only reacts to the resulting boolean signal.
 *
 * ROUTE (table-safe): the Project Room table is a box x -12.4..-10.6,
 * z 5.05..5.95, and the waypoint graph's final leg from proj-in
 * (-11.5, 3.0) to a guest chair cuts diagonally through it. So the
 * visitor first pathfinds to the open south-east corner (-8.0, 8.0),
 * then takes an explicit straight west leg to (-12.5, 8.0) and a
 * straight north leg into the guest chair (-12.5, 6.4) — neither leg
 * enters the table box. Difia's own leg is safe directly: proj-in to
 * the boss chair runs straight south and stops north of the table.
 * Participants return home via the normal pathfinder (never teleport);
 * the one exception is Nayla while guest chat is active, where the
 * ReceptionDirector takes over from the guest chair instead of a
 * home trip fighting it.
 *
 * Guards: a briefing never starts while either participant is in an
 * active meeting, mid-prayer, or non-idle, and never yanks a prayer
 * mid-phase — the tick simply waits. Wander and prayer directors skip
 * briefing participants (same pattern as the meeting guard).
 */
const PM_ID = "difia";
const TICK_MS = 1000;
/** Gentle stroll, same speed as the wander system. */
const BRIEF_SPEED = 1.2;
/** How long the talking phase lasts before the visitor returns. */
export const BRIEF_TALK_MS = 8000;
/** Guest chair used by every briefing (deterministic, one at a time). */
export const BRIEF_GUEST_CHAIR = { x: -12.5, z: 6.4 } as const;
/** Stable id for a guest-order report briefing (one per signal episode). */
export const GUEST_BRIEFING_ID = "guest-briefing" as const;
/**
 * Generic dialogue-strip caption for guest-order report briefings.
 * The ONLY strip text allowed for such briefings (privacy rule above):
 * it names the kind of conversation, never the guest's order itself.
 */
export const GUEST_BRIEFING_STRIP_TEXT = "Membahas pesanan tamu" as const;
/** North-facing (toward the boss chair). */
export const BRIEF_GUEST_FACING = Math.PI;
/** Open south-east corner of the Project Room, clear of the table. */
const PROJECT_SOUTH_EAST = { x: -8.0, z: 8.0 } as const;

type Phase = "idle" | "moving" | "talking";
let phase: Phase = "idle";
let activeId: string | null = null;
let talkingUntil = 0;
let initialTaskIds: Set<string> | null = null;
const briefedTaskIds = new Set<string>();
/**
 * True once the current guest-order signal episode has had its
 * briefing. Without this, the director would restart a report briefing
 * on every tick until the PM task is completed (the signal stays true
 * until then). Reset when the signal clears.
 */
let guestBriefingCompleted = false;

function inActiveMeeting(id: string): boolean {
  const meetings = useMeetingStore.getState().meetings;
  for (const m of meetings) {
    if (m.phase !== "done" && m.participantIds.includes(id)) return true;
  }
  return false;
}

function canStart(visitorId: string): boolean {
  const agents = useAgentStore.getState().agents;
  const pm = agents[PM_ID];
  const visitor = agents[visitorId];
  if (!pm || !visitor) return false;
  if (pm.status !== "idle" || visitor.status !== "idle") return false;
  if (inActiveMeeting(PM_ID) || inActiveMeeting(visitorId)) return false;
  if (!movement.isRegistered(PM_ID) || !movement.isRegistered(visitorId)) {
    return false;
  }
  const presences = usePresenceStore.getState().presences;
  if (presences[PM_ID]?.prayerPose || presences[visitorId]?.prayerPose) {
    return false;
  }
  if (movement.isMoving(PM_ID) || movement.isMoving(visitorId)) return false;
  return true;
}

function startTalking(briefing: Briefing): void {
  phase = "talking";
  talkingUntil = Date.now() + BRIEF_TALK_MS;
  // Instruction: the PM speaks, the worker listens. Report: the visitor
  // speaks, the PM listens.
  useBriefingStore
    .getState()
    .setSpeaker(briefing.kind === "instruction" ? PM_ID : briefing.visitorId);
}

function seatVisitor(briefing: Briefing): void {
  movement.moveTo(
    briefing.visitorId,
    [
      { x: BRIEF_GUEST_CHAIR.x, z: 8.0 },
      { x: BRIEF_GUEST_CHAIR.x, z: BRIEF_GUEST_CHAIR.z },
    ],
    {
      speed: BRIEF_SPEED,
      arriveActivity: "seated",
      arrivePose: "desk",
      arriveFacing: BRIEF_GUEST_FACING,
      onArrive: () => startTalking(briefing),
    },
  );
}

function startFlow(briefing: Briefing): void {
  phase = "moving";
  activeId = briefing.id;
  cancelWanderFor(briefing.visitorId);
  cancelWanderFor(PM_ID);
  const pmPos = movement.getPosition(PM_ID);
  const pmSeated =
    pmPos !== null &&
    Math.hypot(pmPos.x - PM_HOME.x, pmPos.z - PM_HOME.z) <= 0.5 &&
    !movement.isMoving(PM_ID);
  if (pmSeated) {
    movement.setFacing(PM_ID, PM_HOME.facing);
    const p = usePresenceStore.getState().presences[PM_ID];
    if (p?.pose !== "desk" || p?.activity !== "seated") {
      usePresenceStore.getState().setPresence(PM_ID, {
        activity: "seated",
        pose: "desk",
      });
    }
    startVisitorLeg(briefing);
    return;
  }
  movement.navigateTo(PM_ID, PM_HOME.x, PM_HOME.z, {
    speed: BRIEF_SPEED,
    arriveActivity: "seated",
    arrivePose: "desk",
    arriveFacing: PM_HOME.facing,
    onArrive: () => startVisitorLeg(briefing),
  });
}

function startVisitorLeg(briefing: Briefing): void {
  movement.navigateTo(
    briefing.visitorId,
    PROJECT_SOUTH_EAST.x,
    PROJECT_SOUTH_EAST.z,
    {
      speed: BRIEF_SPEED,
      arriveActivity: "standing",
      arrivePose: "free",
      arriveFacing: BRIEF_GUEST_FACING,
      onArrive: () => seatVisitor(briefing),
    },
  );
}

function returnVisitor(briefing: Briefing): void {
  // Nayla never gets a home trip from a briefing: she belongs to the
  // ReceptionDirector while a guest chat is active, and to wander
  // otherwise — and her lobby-grid spawn sits inside the counter
  // footprint, so routing her "home" would walk her into the counter.
  // Leave her where she stands; the next owner picks her up.
  if (briefing.visitorId === "nayla") {
    return;
  }
  const agent = useAgentStore.getState().agents[briefing.visitorId];
  if (!agent) return;
  const [dx, , dz] = AGENT_SPAWN_POSITION(agent.workstationId);
  movement.navigateTo(briefing.visitorId, dx, dz, {
    speed: BRIEF_SPEED,
    arriveActivity: "seated",
    arrivePose: "desk",
    arriveFacing: AGENT_FACING(agent.workstationId),
  });
}

function endTalking(): void {
  const briefing = useBriefingStore.getState().briefing;
  useBriefingStore.getState().endBriefing();
  phase = "idle";
  activeId = null;
  // A finished report briefing must not restart while its signal
  // episode is still active (the signal only clears when the PM task
  // is completed). Kanban briefings are unaffected: they are keyed by
  // task id in briefedTaskIds, not by this flag.
  if (briefing?.kind === "report") guestBriefingCompleted = true;
  if (briefing) returnVisitor(briefing);
}

function tick(): void {
  const store = useBriefingStore.getState();
  if (initialTaskIds === null) {
    initialTaskIds = new Set(useTaskStore.getState().tasks.map((t) => t.id));
  }
  if (store.briefing === null) {
    // Kanban trigger: a task added after mount, assigned to someone
    // other than Difia, that has not been briefed yet.
    const tasks = useTaskStore.getState().tasks;
    const next = tasks.find(
      (t) =>
        !initialTaskIds?.has(t.id) &&
        !briefedTaskIds.has(t.id) &&
        t.assigneeId !== null &&
        t.assigneeId !== PM_ID &&
        useAgentStore.getState().agents[t.assigneeId] !== undefined,
    );
    if (next && next.assigneeId) {
      briefedTaskIds.add(next.id);
      store.startBriefing({
        id: next.id,
        visitorId: next.assigneeId,
        text: next.title,
        kind: "instruction",
      });
      return;
    }
    // Guest-order signal trigger: the Worker boolean is true (Difia
    // has a pending "Guest request:" task) AND the guest is quiet.
    // Quiet is mandatory — Nayla must not abandon an active
    // conversation to walk to the Project Room. While the signal is
    // on but the guest is still active, the tick simply waits; while
    // the signal is off, the episode guard resets so a later signal
    // episode can brief again. If Nayla is busy (moving, meeting,
    // prayer, non-idle), canStart is false and the tick retries —
    // the episode is only marked complete when a briefing actually
    // ran and ended (see endTalking).
    const signal = useGuestPresenceStore.getState();
    if (!signal.briefingActive) {
      guestBriefingCompleted = false;
      return;
    }
    if (signal.guestActive || guestBriefingCompleted) return;
    if (!canStart("nayla")) return;
    store.startBriefing({
      id: GUEST_BRIEFING_ID,
      visitorId: "nayla",
      text: "",
      kind: "report",
    });
    return;
  }
  // A briefing started externally (store API) with no flow running yet.
  if (phase === "idle" && activeId !== store.briefing.id) {
    if (canStart(store.briefing.visitorId)) startFlow(store.briefing);
    return;
  }
  if (phase === "talking" && Date.now() >= talkingUntil) {
    endTalking();
  }
}

/**
 * Mount once in the dashboard root, next to the other directors. Runs
 * the Kanban/store tick (1 s) while the dashboard scene is mounted,
 * and renders the bottom dialogue strip while talking runs.
 */
export function BriefingDirector() {
  useEffect(() => {
    const store = useGuestPresenceStore.getState();
    void store.fetchBriefing();
    const pollId = window.setInterval(
      () => void useGuestPresenceStore.getState().fetchBriefing(),
      GUEST_PRESENCE_POLL_MS,
    );
    const tickId = window.setInterval(tick, TICK_MS);
    return () => {
      window.clearInterval(pollId);
      window.clearInterval(tickId);
    };
  }, []);
  const briefing = useBriefingStore((s) => s.briefing);
  const speakerId = useBriefingStore((s) => s.speakerId);
  if (!briefing || !speakerId) return null;
  const speaker = useAgentStore((s) => s.agents[speakerId]);
  // Report briefings show ONLY the generic caption (privacy rule):
  // the signal carries no guest content, so no guest text may appear
  // here even though briefing.text is empty. Instruction briefings
  // show their real human-entered task title, or "..." when empty.
  const stripText =
    briefing.kind === "report"
      ? GUEST_BRIEFING_STRIP_TEXT
      : briefing.text.trim()
        ? briefing.text
        : "...";
  return (
    <div className="briefing-strip" role="status" aria-live="polite">
      <span className="briefing-strip-speaker">
        {speaker?.name ?? speakerId}
      </span>
      <span className="briefing-strip-text">{stripText}</span>
    </div>
  );
}

/** Test seam: run one tick synchronously. */
export function _briefingTickForTests(): void {
  tick();
}

/** Test seam: reset director state (flow + Kanban snapshot + briefed set). */
export function _resetBriefingForTests(): void {
  phase = "idle";
  activeId = null;
  talkingUntil = 0;
  initialTaskIds = null;
  briefedTaskIds.clear();
  guestBriefingCompleted = false;
  useBriefingStore.getState().endBriefing();
}

/** Test seam: force the talking phase to end now (returns the visitor). */
export function _endBriefingTalkForTests(): void {
  if (phase === "talking") endTalking();
}
