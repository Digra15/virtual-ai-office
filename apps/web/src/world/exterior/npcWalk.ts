/**
 * Pure pedestrian-walk helpers (unit-tested).
 *
 * No-interpenetration rule for pedestrians: NPCs stroll the far
 * sidewalk back and forth between NPC_MIN_X and NPC_MAX_X, turning
 * around at the ends instead of teleporting like the road traffic
 * does. Two rules keep them from ever walking through each other:
 *
 * 1. Separate lanes by direction, like road traffic keeps left:
 *    eastbound NPCs walk the outer lane (z=33), westbound the inner
 *    lane (z=32). Head-on meetings pass with a 1.0 m center gap,
 *    wider than two body radii (2 x ~0.35). When an NPC turns around
 *    at the ends it arcs across to the other lane.
 * 2. Same-direction following: NPCs sharing a lane and direction
 *    keep at least NPC_MIN_GAP between centers (applyNpcSpacing),
 *    so a faster walker queues behind a slower one instead of
 *    passing through them.
 */

export const NPC_LANE_EAST_Z = 33;
export const NPC_LANE_WEST_Z = 32;
export const NPC_MIN_X = -63;
export const NPC_MAX_X = 63;
/** Minimum center-to-center gap for same-lane, same-direction NPCs. */
export const NPC_MIN_GAP = 0.9;
/** Lateral speed (m/s) when arcing between lanes at a turnaround. */
export const NPC_LANE_CHANGE_SPEED = 2.0;

/** Sidewalk lane for a walk direction: eastbound outer, westbound inner. */
export function npcLaneZ(dir: 1 | -1): number {
  return dir === 1 ? NPC_LANE_EAST_Z : NPC_LANE_WEST_Z;
}

/**
 * Enforce the same-direction following gap. Returns new x positions
 * in the input order: within each direction group, walkers behind
 * the leader are clamped to leader -/+ NPC_MIN_GAP, chained so a
 * queue cannot compress. Opposite directions never share a lane,
 * so they need no clamp here.
 */
export function applyNpcSpacing(items: { x: number; dir: 1 | -1 }[]): number[] {
  const xs = items.map((i) => i.x);
  for (const dir of [1, -1] as const) {
    const idx = items.map((it, i) => (it.dir === dir ? i : -1)).filter((i) => i >= 0);
    idx.sort((a, b) => (dir === 1 ? xs[b] - xs[a] : xs[a] - xs[b]));
    for (let k = 1; k < idx.length; k++) {
      const leader = xs[idx[k - 1]];
      const me = idx[k];
      xs[me] = dir === 1 ? Math.min(xs[me], leader - NPC_MIN_GAP) : Math.max(xs[me], leader + NPC_MIN_GAP);
    }
  }
  return xs;
}

/** One step of ping-pong walking: advance, flip direction at the ends. */
export function npcStep(
  x: number,
  dir: 1 | -1,
  speed: number,
  dt: number,
  minX: number = NPC_MIN_X,
  maxX: number = NPC_MAX_X,
): { x: number; dir: 1 | -1 } {
  let nx = x + dir * speed * dt;
  let ndir = dir;
  if (nx > maxX) {
    nx = maxX;
    ndir = -1;
  } else if (nx < minX) {
    nx = minX;
    ndir = 1;
  }
  return { x: nx, dir: ndir };
}

/** Target facing for a walk direction: +x -> PI/2, -x -> -PI/2. */
export function npcTargetYaw(dir: 1 | -1): number {
  return dir === 1 ? Math.PI / 2 : -Math.PI / 2;
}

/** Shortest-arc yaw damping toward the target (rate per second). */
export function npcDampYaw(
  yaw: number,
  target: number,
  dt: number,
  rate: number = 8,
): number {
  const diff = (((target - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  return yaw + diff * Math.min(1, dt * rate);
}
