import { useEffect } from "react";
import { useAgentStore } from "../../stores/useAgentStore";
import { useMeetingStore } from "../../stores/useMeetingStore";
import { usePresenceStore } from "../../stores/usePresenceStore";
import {
  GUEST_PRESENCE_POLL_MS,
  useGuestPresenceStore,
} from "../../stores/useGuestPresenceStore";
import { movement } from "../../world/movement";
import { cancelWanderFor } from "../wander/WanderDirector";

/**
 * Difia reception standby director (dashboard scene only).
 *
 * Difia's home is the reception desk. While a guest chat is active she
 * must be on standby AT reception: she WALKS (never teleports) to the
 * standby spot behind the counter, faces the entrance (south), and stays
 * there — no pantry trips, no toilet trips, no wandering — until the
 * guest activity ends. While no guest chat is active she roams like any
 * other idle agent.
 *
 * Standby is not frozen: she uses the existing Idle animation (activity
 * "standing", pose "free") and walks to reception when summoned.
 *
 * How the pieces fit:
 * - Presence comes from useGuestPresenceStore (Worker route, with a
 *   local-widget fallback for old Workers — see that store).
 * - Wander suppression lives in WanderDirector (it skips Difia for new
 *   trips AND for return-home while guestActive) plus cancelWanderFor
 *   here, so a wander trip in progress never pulls her off standby.
 * - Prayer is handled in PrayerDirector: a prayer pose in progress is
 *   allowed to finish its current phase, then released (never yanked
 *   mid-pose), and no new prayer cycle starts for Difia while active.
 * - Meetings and non-idle statuses (working, recovering, …) are never
 *   interrupted: summoning waits until she is idle and free.
 * - On release (guestActive clears) she is NOT teleported anywhere —
 *   wander resumes on its own next cycle from wherever she stands.
 *
 * Caveat (standing for the whole movement system): agent movement only
 * renders while a `/` tab with the 3D scene is open. This director runs
 * in the dashboard, so that is where standby is visible.
 */

const DIFIA_ID = "difia";
const TICK_MS = 4000;
/** Gentle stroll, same speed as the wander system. */
const SUMMON_SPEED = 1.2;
/** Within this distance of the spot she counts as "at standby". */
const AT_STANDBY_DIST = 0.5;

/**
 * Standby spot: directly north of the reception counter (same x as its
 * center), in the open workspace south band. The geometrically obvious
 * spot right behind the counter — (-4, 6.x) — is enclosed by the counter
 * box (x -5.9..-2.1, z 6.85..7.95), the reception-chair circle (-4, 6.7)
 * and the plant (-1.6, 7.4): every lobby approach leg to it is blocked,
 * so the pathfinder would fall back to a straight leg that clips the
 * counter. (-4, 5.5) is the nearest cleanly walkable spot on the same
 * north axis: no obstacle within agent radius, reachable via aisle-3,
 * and facing south (0) she looks straight at the counter and the
 * entrance beyond it. The existing reception fallback spawn (-2.4, 7.8)
 * is NOT reused: it sits inside the counter footprint.
 */
export const DIFIA_STANDBY_SPOT = { x: -4, z: 5.5 } as const;
/** South (+z), toward the entrance. */
export const DIFIA_STANDBY_FACING = 0;

/** True while Difia is routed to / standing at standby by this director. */
let summoned = false;

function inActiveMeeting(id: string): boolean {
  const meetings = useMeetingStore.getState().meetings;
  for (const m of meetings) {
    if (m.phase !== "done" && m.participantIds.includes(id)) return true;
  }
  return false;
}

function tick(): void {
  const active = useGuestPresenceStore.getState().guestActive;
  const difia = useAgentStore.getState().agents[DIFIA_ID];
  if (!difia) {
    summoned = false;
    return;
  }
  if (!active) {
    // Release: wander resumes on its own next cycle. Never teleport her.
    summoned = false;
    return;
  }
  // Guest active: Difia belongs at reception — unless she is busy.
  if (difia.status !== "idle") return;
  if (inActiveMeeting(DIFIA_ID)) return;
  if (!movement.isRegistered(DIFIA_ID)) return;
  // Prayer finishes first (PrayerDirector releases her at the next phase
  // boundary and never starts a new cycle while active) — never yank her
  // mid-pose, or the motion reads as broken.
  const presence = usePresenceStore.getState().presences[DIFIA_ID];
  if (presence?.prayerPose) return;
  const pos = movement.getPosition(DIFIA_ID);
  if (!pos) return;
  const atStandby =
    Math.hypot(
      pos.x - DIFIA_STANDBY_SPOT.x,
      pos.z - DIFIA_STANDBY_SPOT.z,
    ) <= AT_STANDBY_DIST;
  if (atStandby && !movement.isMoving(DIFIA_ID)) {
    // Standing at standby: make sure she faces the entrance even if she
    // arrived here some other way.
    movement.setFacing(DIFIA_ID, DIFIA_STANDBY_FACING);
    summoned = true;
    return;
  }
  if (movement.isMoving(DIFIA_ID) && summoned) return; // already en route
  // Route (or re-route) her to standby on foot. Cancel any wander trip
  // first so the wander return-home tick never pulls her off standby.
  cancelWanderFor(DIFIA_ID);
  summoned = true;
  movement.navigateTo(
    DIFIA_ID,
    DIFIA_STANDBY_SPOT.x,
    DIFIA_STANDBY_SPOT.z,
    {
      speed: SUMMON_SPEED,
      arriveActivity: "standing",
      arrivePose: "free",
      arriveFacing: DIFIA_STANDBY_FACING,
    },
  );
}

/**
 * Mount once in the dashboard root, next to the other directors. Runs
 * the presence poll (30 s) and the summon tick (4 s) while the dashboard
 * scene is mounted.
 */
export function ReceptionDirector() {
  useEffect(() => {
    const store = useGuestPresenceStore.getState();
    void store.fetchRemote();
    const pollId = window.setInterval(
      () => void useGuestPresenceStore.getState().fetchRemote(),
      GUEST_PRESENCE_POLL_MS,
    );
    const tickId = window.setInterval(tick, TICK_MS);
    return () => {
      window.clearInterval(pollId);
      window.clearInterval(tickId);
    };
  }, []);
  return null;
}

/** Test seam: run one tick synchronously. */
export function _receptionTickForTests(): void {
  tick();
}

/** Test seam: reset director state. */
export function _resetReceptionForTests(): void {
  summoned = false;
}
