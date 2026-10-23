import { useEffect } from "react";
import { useAgentStore } from "../../stores/useAgentStore";
import { useMeetingStore } from "../../stores/useMeetingStore";
import { movement } from "../../world/movement";
import { AGENT_FACING, AGENT_SPAWN_POSITION } from "../../world/layout";

/**
 * Idle wandering director (simulated behavior).
 *
 * Every few seconds it looks for `idle` agents that are seated at their
 * desks and, if fewer than MAX_CONCURRENT are already wandering, sends one
 * for a gentle stroll to a random pleasant spot on the single floor.
 * After a cooldown the agent strolls back to its desk.
 *
 * Wandering into the musola triggers the prayer state automatically —
 * it is position-based (see facing.ts isInMusola), regardless of how the
 * agent got there.
 *
 * Rules that keep it calm, not chaotic:
 * - max 2 agents wandering at once
 * - slow walk speed
 * - 20–40s cooldown between wanders per agent
 * - never interrupts a meeting participant
 * - never moves agents that are already walking
 */

const TICK_MS = 4000;
const MAX_CONCURRENT = 2;
const WANDER_SPEED = 1.2;
const COOLDOWN_MIN_MS = 20_000;
const COOLDOWN_MAX_MS = 40_000;
const STROLL_STAY_MS = 25_000;

interface WanderState {
  cooldownUntil: number;
  /** When set, the agent should head home on the next tick. */
  returnAt: number | null;
  wandering: boolean;
}

const states = new Map<string, WanderState>();

export interface WanderSpot {
  x: number;
  z: number;
  label: string;
}

/**
 * Idle wander destinations (single floor, y = 0). Musola spots sit on the
 * prayer rows (x -13.2..-10, z -9.5) so a stroll there becomes a prayer
 * visit via the position-based trigger.
 */
export const WANDER_SPOTS: WanderSpot[] = [
  { x: -13.2, z: -9.5, label: "musola" },
  { x: -11.6, z: -9.5, label: "musola" },
  { x: -10.0, z: -9.5, label: "musola" },
  { x: 4.2, z: -7.5, label: "pantry" },
  { x: 6.5, z: 6.5, label: "lobby sofa" },
  { x: 0, z: -3, label: "corridor" },
  { x: 0, z: 4.2, label: "aisle" },
];

function getState(id: string): WanderState {
  let s = states.get(id);
  if (!s) {
    s = { cooldownUntil: 0, returnAt: null, wandering: false };
    states.set(id, s);
  }
  return s;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function tick(): void {
  const now = Date.now();
  const agents = useAgentStore.getState().agents;
  const meetingStore = useMeetingStore.getState();
  const inMeeting = new Set<string>();
  for (const m of meetingStore.meetings) {
    if (m.phase !== "done") for (const pid of m.participantIds) inMeeting.add(pid);
  }

  // 1. Send wanderers home when their stroll is over.
  for (const [id, s] of states) {
    if (s.returnAt !== null && now >= s.returnAt && !movement.isMoving(id)) {
      const agent = agents[id];
      s.returnAt = null;
      s.wandering = false;
      if (agent && !inMeeting.has(id)) {
        const [dx, , dz] = AGENT_SPAWN_POSITION(agent.workstationId);
        movement.navigateTo(id, dx, dz, {
          speed: WANDER_SPEED,
          arriveActivity: "seated",
          arrivePose: "desk",
          arriveFacing: AGENT_FACING(agent.workstationId),
          onArrive: () => {
            const st = getState(id);
            st.cooldownUntil = Date.now() + rand(COOLDOWN_MIN_MS, COOLDOWN_MAX_MS);
          },
        });
      }
    }
  }

  // 2. Start new wanders (respect the concurrency cap).
  let wandering = 0;
  for (const s of states.values()) if (s.wandering) wandering += 1;
  if (wandering >= MAX_CONCURRENT) return;

  const candidates = Object.values(agents).filter((a) => {
    if (a.status !== "idle") return false;
    if (inMeeting.has(a.id)) return false;
    if (movement.isMoving(a.id)) return false;
    if (!movement.isRegistered(a.id)) return false;
    const s = getState(a.id);
    if (s.wandering || s.returnAt !== null) return false;
    return now >= s.cooldownUntil;
  });
  if (candidates.length === 0) return;

  const agent = candidates[Math.floor(Math.random() * candidates.length)];
  const spot = WANDER_SPOTS[Math.floor(Math.random() * WANDER_SPOTS.length)];
  const ok = movement.navigateTo(agent.id, spot.x, spot.z, {
    speed: WANDER_SPEED,
    arriveActivity: "standing",
    arrivePose: "free",
    arriveFacing: null,
    onArrive: () => {
      const st = getState(agent.id);
      st.returnAt = Date.now() + STROLL_STAY_MS + rand(0, 15_000);
    },
  });
  if (ok) {
    const s = getState(agent.id);
    s.wandering = true;
    s.cooldownUntil = now + rand(COOLDOWN_MIN_MS, COOLDOWN_MAX_MS);
  }
}

/**
 * Mount once in the app root. Runs the wander tick on an interval.
 * Purely client-side simulated behavior.
 */
export function WanderDirector() {
  useEffect(() => {
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return null;
}

/** Test seam: run one tick synchronously. */
export function _wanderTickForTests(): void {
  tick();
}

/** Test seam: reset wander state. */
export function _resetWanderForTests(): void {
  states.clear();
}
