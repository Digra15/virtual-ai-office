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
import { isInBriefing } from "../../stores/useBriefingStore";

/**
 * Nayla reception standby director (dashboard scene only).
 *
 * Nayla's home is the reception desk. While a guest chat is active she
 * must be on standby AT reception: she WALKS (never teleports) to the
 * receptionist chair and SITS there (activity "seated", pose "desk" —
 * the same seated fake desk agents use, so no typing pose: her status
 * stays idle), facing the entrance (south), and stays there — no pantry
 * trips, no toilet trips, no wandering — until the guest activity
 * ends. While no guest chat is active she roams like any other idle
 * agent.
 *
 * Two-stage route, because a direct pathfind to the chair clips the
 * counter: the waypoint graph routes via lobby (0, 8.6), and the final
 * lobby→chair leg cuts diagonally through the counter box. So she first
 * walks to the staging spot north of the chair, then takes one short
 * straight south leg into the chair. That leg never enters the counter
 * footprint (the counter's north edge is z 6.85; the chair sits at
 * z 6.7).
 *
 * How the pieces fit:
 * - Presence comes from useGuestPresenceStore (Worker route, with a
 *   local-widget fallback for old Workers — see that store).
 * - Wander suppression lives in WanderDirector (it skips Nayla for new
 *   trips AND for return-home while guestActive) plus cancelWanderFor
 *   here, so a wander trip in progress never pulls her off standby.
 * - Prayer is handled in PrayerDirector: a prayer pose in progress is
 *   allowed to finish its current phase, then released (never yanked
 *   mid-pose), and no new prayer cycle starts for Nayla while active.
 * - Meetings and non-idle statuses (working, recovering, …) are never
 *   interrupted: summoning waits until she is idle and free.
 * - On release (guestActive clears) she is NOT teleported anywhere —
 *   wander resumes on its own next cycle from wherever she stands.
 *
 * Caveat (standing for the whole movement system): agent movement only
 * renders while a `/` tab with the 3D scene is open. This director runs
 * in the dashboard, so that is where standby is visible.
 */

const NAYLA_ID = "nayla";
const TICK_MS = 4000;
/** Gentle stroll, same speed as the wander system. */
const SUMMON_SPEED = 1.2;

/**
 * Staging spot: directly north of the reception chair, in the open
 * workspace south band. (-4, 5.5) is the nearest cleanly walkable spot
 * on the chair's north axis: no obstacle within agent radius, reachable
 * via aisle-3. The existing reception fallback spawn (-2.4, 7.8) is NOT
 * reused: it sits inside the counter footprint.
 */
export const NAYLA_STANDBY_SPOT = { x: -4, z: 5.5 } as const;
/**
 * The receptionist chair itself: GamingChair in Reception.tsx, same
 * coordinates and facing. Sitting here means pose "desk" (model sunk
 * 0.18, as for desk agents) at exactly the chair's position.
 */
export const NAYLA_STANDBY_CHAIR = { x: -4, z: 6.7 } as const;
/** South (+z), toward the counter and the entrance beyond it. */
export const NAYLA_STANDBY_FACING = 0;

/** Within this distance of the chair she counts as "seated at standby". */
const AT_CHAIR_DIST = 0.5;

/** True while Nayla is routed to / sitting at standby by this director. */
let summoned = false;

/**
 * Second stage: one short straight south leg from the staging corridor
 * into the receptionist chair, arriving seated. This deliberately
 * bypasses the waypoint pathfinder (movement.moveTo with an explicit
 * path) — a pathfound route would come via lobby and clip the counter.
 * Only ever called when she is already aligned north of the chair
 * (staging spot, or the onArrive callback of the staging leg), so the
 * straight leg stays clear of the counter footprint.
 */
function sitOnChair(): void {
  movement.moveTo(NAYLA_ID, [{ x: NAYLA_STANDBY_CHAIR.x, z: NAYLA_STANDBY_CHAIR.z }], {
    speed: SUMMON_SPEED,
    arriveActivity: "seated",
    arrivePose: "desk",
    arriveFacing: NAYLA_STANDBY_FACING,
  });
}

function inActiveMeeting(id: string): boolean {
  const meetings = useMeetingStore.getState().meetings;
  for (const m of meetings) {
    if (m.phase !== "done" && m.participantIds.includes(id)) return true;
  }
  return false;
}

function tick(): void {
  const active = useGuestPresenceStore.getState().guestActive;
  const nayla = useAgentStore.getState().agents[NAYLA_ID];
  if (!nayla) {
    summoned = false;
    return;
  }
  if (!active) {
    // Release: wander resumes on its own next cycle. Never teleport her.
    summoned = false;
    return;
  }
  // Guest active: Nayla belongs at reception — unless she is busy.
  if (nayla.status !== "idle") return;
  if (inActiveMeeting(NAYLA_ID)) return;
  // Briefing owns her while she is in the Project Room — never yank
  // her back to reception mid-briefing.
  if (isInBriefing(NAYLA_ID)) return;
  if (!movement.isRegistered(NAYLA_ID)) return;
  // Prayer finishes first (PrayerDirector releases her at the next phase
  // boundary and never starts a new cycle while active) — never yank her
  // mid-pose, or the motion reads as broken.
  const presence = usePresenceStore.getState().presences[NAYLA_ID];
  if (presence?.prayerPose) return;
  const pos = movement.getPosition(NAYLA_ID);
  if (!pos) return;
  const atChair =
    Math.hypot(
      pos.x - NAYLA_STANDBY_CHAIR.x,
      pos.z - NAYLA_STANDBY_CHAIR.z,
    ) <= AT_CHAIR_DIST;
  if (atChair && !movement.isMoving(NAYLA_ID)) {
    // Seated at standby: make sure she faces the entrance and stays
    // seated even if she arrived here some other way.
    movement.setFacing(NAYLA_ID, NAYLA_STANDBY_FACING);
    const p = presence;
    if (p?.pose !== "desk" || p?.activity !== "seated") {
      usePresenceStore.getState().setPresence(NAYLA_ID, {
        activity: "seated",
        pose: "desk",
      });
    }
    summoned = true;
    return;
  }
  if (movement.isMoving(NAYLA_ID) && summoned) return; // already en route
  // Aligned north of the chair (staging spot or the corridor between
  // staging and chair): take the short straight leg straight into it.
  // This leg never enters the counter footprint (north edge z 6.85).
  const alignedNorth =
    Math.abs(pos.x - NAYLA_STANDBY_CHAIR.x) < 0.6 &&
    pos.z >= NAYLA_STANDBY_SPOT.z &&
    pos.z <= NAYLA_STANDBY_CHAIR.z;
  cancelWanderFor(NAYLA_ID);
  summoned = true;
  if (alignedNorth) {
    sitOnChair();
    return;
  }
  // Route (or re-route) her to the staging spot on foot, then sit.
  // Cancel any wander trip first so the wander return-home tick never
  // pulls her off standby.
  movement.navigateTo(
    NAYLA_ID,
    NAYLA_STANDBY_SPOT.x,
    NAYLA_STANDBY_SPOT.z,
    {
      speed: SUMMON_SPEED,
      arriveActivity: "standing",
      arrivePose: "free",
      arriveFacing: NAYLA_STANDBY_FACING,
      onArrive: () => {
        // Guest may have left while she walked here; the tick owns
        // routing from now on, so only sit if standby is still wanted
        // and she is not mid-prayer.
        if (!useGuestPresenceStore.getState().guestActive) return;
        if (usePresenceStore.getState().presences[NAYLA_ID]?.prayerPose) return;
        sitOnChair();
      },
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
