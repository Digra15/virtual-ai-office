/**
 * Pure pedestrian-walk helpers (unit-tested).
 *
 * NPCs stroll the far sidewalk (z=32) back and forth between
 * NPC_MIN_X and NPC_MAX_X, turning around at the ends instead of
 * teleporting like the road traffic does.
 */

export const NPC_LANE_Z = 32;
export const NPC_MIN_X = -63;
export const NPC_MAX_X = 63;

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
