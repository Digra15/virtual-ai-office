import { useEffect } from "react";
import { useAgentStore } from "../../stores/useAgentStore";
import { useMeetingStore } from "../../stores/useMeetingStore";
import { usePresenceStore } from "../../stores/usePresenceStore";
import { useTaskStore } from "../../stores/useTaskStore";
import { useGuestPresenceStore } from "../../stores/useGuestPresenceStore";
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
 * the dashboard scene is open. It is NOT a guest-order trigger and
 * must never be presented as one: guest threads live in the Worker,
 * the dashboard does not poll them, and Worker task creation
 * broadcasts nothing to the scene, so a guest order cannot start a
 * briefing on its own today. The programmatic entry point for the
 * future poller bridge is useBriefingStore.startBriefing(visitorId,
 * text, kind) — a bridge run may call it when it turns a guest thread
 * into a PM task (TODO, parent phase). Until then, briefings only
 * start from the Kanban trigger or that store call.
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
  // Nayla with an active guest chat belongs to the ReceptionDirector
  // from here on — a home trip would fight its next tick.
  if (
    briefing.visitorId === "nayla" &&
    useGuestPresenceStore.getState().guestActive
  ) {
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
    }
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
    const tickId = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(tickId);
  }, []);
  const briefing = useBriefingStore((s) => s.briefing);
  const speakerId = useBriefingStore((s) => s.speakerId);
  if (!briefing || !speakerId) return null;
  const speaker = useAgentStore((s) => s.agents[speakerId]);
  return (
    <div className="briefing-strip" role="status" aria-live="polite">
      <span className="briefing-strip-speaker">
        {speaker?.name ?? speakerId}
      </span>
      <span className="briefing-strip-text">
        {briefing.text.trim() ? briefing.text : "..."}
      </span>
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
  useBriefingStore.getState().endBriefing();
}

/** Test seam: force the talking phase to end now (returns the visitor). */
export function _endBriefingTalkForTests(): void {
  if (phase === "talking") endTalking();
}
