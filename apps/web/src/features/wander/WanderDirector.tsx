import { useEffect } from "react";
import { useAgentStore } from "../../stores/useAgentStore";
import { useMeetingStore } from "../../stores/useMeetingStore";
import { usePresenceStore } from "../../stores/usePresenceStore";
import { movement } from "../../world/movement";
import { AGENT_FACING, AGENT_SPAWN_POSITION } from "../../world/layout";
import { PANTRY_CHAIR_SLOTS } from "../../world/building/rooms/Pantry";
import { QIBLA_FACING } from "../../world/characters/facing";

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
  /** Pantry chair index this agent is heading to / sitting on, if any. */
  pantryChair: number | null;
}

const states = new Map<string, WanderState>();

export interface WanderSpot {
  x: number;
  z: number;
  label: string;
  /** Y rotation (radians) the agent should face when arriving; null = keep travel direction. */
  facing?: number | null;
  /** Pantry chair index (from PANTRY_CHAIR_SLOTS) — only one agent per chair. */
  pantryChair?: number;
  /** Activity on arrival (default "standing"). */
  arriveActivity?: "standing" | "break";
  /** Pose on arrival (default "free"). */
  arrivePose?: "desk" | "free";
}

/**
 * Idle wander destinations (single floor, y = 0). Musola spots sit on the
 * prayer rows (x -13.2..-10, z -9.5) so a stroll there becomes a prayer
 * visit via the position-based trigger. Pantry spots are the 4 dining
 * chairs — agents sit and take a coffee + snack break there.
 */
export const WANDER_SPOTS: WanderSpot[] = [
  // Musola prayer rows face the qibla (west) on arrival so the
  // PrayerDirector's cycle starts from the right direction.
  { x: -13.2, z: -9.5, label: "musola", facing: QIBLA_FACING },
  { x: -11.6, z: -9.5, label: "musola", facing: QIBLA_FACING },
  { x: -10.0, z: -9.5, label: "musola", facing: QIBLA_FACING },
  ...PANTRY_CHAIR_SLOTS.map((s, i) => ({
    x: s.position[0],
    z: s.position[2],
    label: "pantry",
    facing: s.rotationY,
    pantryChair: i,
    arriveActivity: "break" as const,
    arrivePose: "desk" as const,
  })),
  // Lobby sofa at (6.5,6.5) faces south (+Z) toward the coffee table —
  // the agent SITS on it (arrivePose "desk" sinks the model onto the
  // seat) facing the table (facing 0), not standing inside the sofa.
  { x: 6.5, z: 6.5, label: "lobby sofa", facing: 0, arrivePose: "desk" },
  { x: 0, z: -3, label: "corridor" },
  { x: 0, z: 4.2, label: "aisle" },
];

function getState(id: string): WanderState {
  let s = states.get(id);
  if (!s) {
    s = { cooldownUntil: 0, returnAt: null, wandering: false, pantryChair: null };
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
      s.pantryChair = null;
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
  // Pantry chairs are single-occupancy: exclude chairs another wanderer
  // is heading to, sitting on, or still marked as on break.
  const takenChairs = new Set<number>();
  for (const [otherId, s] of states) {
    if (otherId === agent.id) continue;
    if (s.pantryChair !== null) takenChairs.add(s.pantryChair);
  }
  for (const [otherId, p] of Object.entries(
    usePresenceStore.getState().presences,
  )) {
    if (otherId === agent.id || p.activity !== "break") continue;
    const s = states.get(otherId);
    if (s?.pantryChair !== null && s?.pantryChair !== undefined)
      takenChairs.add(s.pantryChair);
  }
  const freeSpots = WANDER_SPOTS.filter(
    (sp) => sp.pantryChair === undefined || !takenChairs.has(sp.pantryChair),
  );
  if (freeSpots.length === 0) return;
  const spot = freeSpots[Math.floor(Math.random() * freeSpots.length)];
  const ok = movement.navigateTo(agent.id, spot.x, spot.z, {
    speed: WANDER_SPEED,
    arriveActivity: spot.arriveActivity ?? "standing",
    arrivePose: spot.arrivePose ?? "free",
    arriveFacing: spot.facing ?? null,
    onArrive: () => {
      const st = getState(agent.id);
      st.returnAt = Date.now() + STROLL_STAY_MS + rand(0, 15_000);
    },
  });
  if (ok) {
    const s = getState(agent.id);
    s.wandering = true;
    s.pantryChair = spot.pantryChair ?? null;
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
