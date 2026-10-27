import { useEffect } from "react";
import { useAgentStore } from "../../stores/useAgentStore";
import { useMeetingStore } from "../../stores/useMeetingStore";
import {
  usePresenceStore,
  type PrayerPose,
} from "../../stores/usePresenceStore";
import { useGuestPresenceStore } from "../../stores/useGuestPresenceStore";
import { movement } from "../../world/movement";
import { isInMusola, QIBLA_FACING } from "../../world/characters/facing";

/**
 * Faked prayer-motion director (CUTES rig has no knee/waist joints, so
 * there is no skeletal prayer animation — see PrayerPose in
 * usePresenceStore).
 *
 * Every second it looks for agents standing inside the musola and cycles
 * them through a prayer sequence: qiyam (standing) → ruku (bow) →
 * qawmah (standing) → sujud (prostrate) → duduk (squat) → sujud →
 * back to qiyam, looping while they stay in the musola. On prayer start
 * the agent is turned to face the qibla (west).
 *
 * The cycle clears the moment the agent walks away, joins a meeting, or
 * leaves the musola — the WanderDirector's return-home walk handles the
 * rest, so prayer never blocks locomotion.
 */

const TICK_MS = 1000;

/** One prayer cycle. pose null = standing (qiyam/qawmah). */
const PHASES: Array<{ pose: PrayerPose; ms: number }> = [
  { pose: null, ms: 5000 }, // qiyam
  { pose: "bowing", ms: 3000 }, // ruku
  { pose: null, ms: 2000 }, // qawmah (i'tidal)
  { pose: "prostrate", ms: 3000 }, // sujud 1
  { pose: "sitting", ms: 2000 }, // duduk antara dua sujud
  { pose: "prostrate", ms: 3000 }, // sujud 2
];

interface PrayerState {
  phaseIdx: number;
  phaseUntil: number;
  appliedPose: PrayerPose | undefined;
}

const states = new Map<string, PrayerState>();

function clearPrayer(id: string): void {
  const s = states.get(id);
  if (s !== undefined) {
    states.delete(id);
    if (s.appliedPose !== undefined && s.appliedPose !== null) {
      usePresenceStore
        .getState()
        .setPresence(id, { prayerPose: null });
    }
  }
}

function tick(): void {
  const now = Date.now();
  const agents = useAgentStore.getState().agents;
  const presences = usePresenceStore.getState().presences;
  const meetingStore = useMeetingStore.getState();
  const inMeeting = new Set<string>();
  for (const m of meetingStore.meetings) {
    if (m.phase !== "done") for (const pid of m.participantIds) inMeeting.add(pid);
  }

  for (const agent of Object.values(agents)) {
    const id = agent.id;
    const presence = presences[id];
    const praying =
      !movement.isMoving(id) &&
      !inMeeting.has(id) &&
      presence?.activity === "standing" &&
      isInMusola(id);

    if (!praying) {
      clearPrayer(id);
      continue;
    }

    let s = states.get(id);
    if (!s) {
      // Reception standby: while a guest chat is active, Difia never
      // STARTS a prayer cycle — the ReceptionDirector routes her to the
      // desk instead. (A cycle already in progress is released at its
      // next phase boundary below, never yanked mid-pose.)
      if (id === "difia" && useGuestPresenceStore.getState().guestActive) continue;
      // Prayer start: face the qibla, begin at qiyam.
      movement.setFacing(id, QIBLA_FACING);
      s = { phaseIdx: 0, phaseUntil: now + PHASES[0].ms, appliedPose: null };
      states.set(id, s);
      continue;
    }

    if (now < s.phaseUntil) continue;
    // Reception standby: Difia's current pose was allowed to finish;
    // release her now instead of advancing the cycle, so the
    // ReceptionDirector can route her to the desk on its next tick.
    if (id === "difia" && useGuestPresenceStore.getState().guestActive) {
      clearPrayer(id);
      continue;
    }
    const nextIdx = (s.phaseIdx + 1) % PHASES.length;
    const nextPose = PHASES[nextIdx].pose;
    s.phaseIdx = nextIdx;
    s.phaseUntil = now + PHASES[nextIdx].ms;
    if (s.appliedPose !== nextPose) {
      s.appliedPose = nextPose;
      usePresenceStore.getState().setPresence(id, { prayerPose: nextPose });
    }
  }

  // Drop state for agents that no longer exist.
  for (const id of [...states.keys()]) {
    if (!(id in agents)) states.delete(id);
  }
}

/**
 * Mount once in the app root. Runs the prayer tick on an interval.
 * Purely client-side simulated behavior.
 */
export function PrayerDirector() {
  useEffect(() => {
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return null;
}

/** Test seam: run one tick synchronously. */
export function _prayerTickForTests(): void {
  tick();
}

/** Test seam: reset prayer state. */
export function _resetPrayerForTests(): void {
  states.clear();
}
