/**
 * Waypoint navigation graph for the office floor.
 *
 * The office is mostly open space with furniture footprints to avoid
 * (desk rows, meeting table, lounge sofas, server racks). Instead of a
 * full nav-mesh, we hand-place waypoints in open corridors and connect
 * them explicitly — simple, deterministic, and easy to extend.
 *
 * Conventions:
 * - All coordinates are floor-plane (x, z); y is always 0.
 * - `findPath(from, to)` returns a list of {x,z} points: the nearest
 *   waypoint to `from`, BFS hops across the graph, then the exact `to`.
 * - Waypoints avoid desk/chair footprints; the final leg to a desk is a
 *   short straight segment from the nearest aisle waypoint.
 */

export interface Waypoint {
  id: string;
  x: number;
  z: number;
  neighbors: string[];
}

/**
 * Hand-placed waypoints. Aisles run between the desk rows; corridors ring
 * the desk block; spurs reach the meeting room, mission control, and lounge.
 */
export const WAYPOINTS: Record<string, Waypoint> = {
  // Aisle between the two desk rows (z=1).
  "aisle-w":  { id: "aisle-w",  x: -9, z: 1, neighbors: ["aisle-wc", "west-c"] },
  "aisle-wc": { id: "aisle-wc", x: -5, z: 1, neighbors: ["aisle-w", "aisle-c"] },
  "aisle-c":  { id: "aisle-c",  x: 0,  z: 1, neighbors: ["aisle-wc", "aisle-ec"] },
  "aisle-ec": { id: "aisle-ec", x: 5,  z: 1, neighbors: ["aisle-c", "aisle-e"] },
  "aisle-e":  { id: "aisle-e",  x: 9,  z: 1, neighbors: ["aisle-ec", "east-c"] },
  // North corridor (z=-4.5), between workspace and the north rooms.
  "north-w":  { id: "north-w",  x: -9, z: -4.5, neighbors: ["north-wc", "west-n", "meet-out"] },
  "north-wc": { id: "north-wc", x: -5, z: -4.5, neighbors: ["north-w", "north-c"] },
  "north-c":  { id: "north-c",  x: 0,  z: -4.5, neighbors: ["north-wc", "north-ec"] },
  "north-ec": { id: "north-ec", x: 5,  z: -4.5, neighbors: ["north-c", "north-e"] },
  "north-e":  { id: "north-e",  x: 9,  z: -4.5, neighbors: ["north-ec", "east-n"] },
  // South corridor (z=7), between workspace and lounge/overflow.
  "south-w":  { id: "south-w",  x: -9, z: 7, neighbors: ["south-wc", "west-s"] },
  "south-wc": { id: "south-wc", x: -5, z: 7, neighbors: ["south-w", "south-c"] },
  "south-c":  { id: "south-c",  x: 0,  z: 7, neighbors: ["south-wc", "south-ec", "lounge-w"] },
  "south-ec": { id: "south-ec", x: 5,  z: 7, neighbors: ["south-c", "south-e", "lounge-c"] },
  "south-e":  { id: "south-e",  x: 9,  z: 7, neighbors: ["south-ec", "east-s"] },
  // West corridor (x=-12) linking north/aisle/south around the desk block.
  "west-n": { id: "west-n", x: -12, z: -4.5, neighbors: ["north-w", "west-c"] },
  "west-c": { id: "west-c", x: -12, z: 1,    neighbors: ["west-n", "west-s", "aisle-w"] },
  "west-s": { id: "west-s", x: -12, z: 7,    neighbors: ["west-c", "south-w"] },
  // East corridor (x=12).
  "east-n": { id: "east-n", x: 12, z: -4.5, neighbors: ["north-e", "east-c", "mission-w"] },
  "east-c": { id: "east-c", x: 12, z: 1,    neighbors: ["east-n", "east-s", "aisle-e"] },
  "east-s": { id: "east-s", x: 12, z: 7,    neighbors: ["east-c", "south-e", "lounge-e"] },
  // Meeting room spur (through the glass partition — treated as a doorway).
  "meet-out": { id: "meet-out", x: -7, z: -9.5, neighbors: ["north-w", "meet-in"] },
  "meet-in":  { id: "meet-in",  x: -10, z: -9.5, neighbors: ["meet-out"] },
  // Mission control spur.
  "mission-w": { id: "mission-w", x: 11, z: -9.5, neighbors: ["east-n", "mission-c"] },
  "mission-c": { id: "mission-c", x: 14, z: -9.5, neighbors: ["mission-w", "mission-e"] },
  "mission-e": { id: "mission-e", x: 17, z: -9.5, neighbors: ["mission-c"] },
  // Lounge spots.
  "lounge-w": { id: "lounge-w", x: 4,  z: 10,   neighbors: ["south-c", "lounge-c"] },
  "lounge-c": { id: "lounge-c", x: 8,  z: 10.5, neighbors: ["lounge-w", "lounge-e", "south-ec"] },
  "lounge-e": { id: "lounge-e", x: 12, z: 10,   neighbors: ["lounge-c", "east-s"] },
};

/** Waypoint ids agents may wander to while idle (open, pleasant spots). */
export const WANDER_WAYPOINT_IDS = [
  "lounge-w",
  "lounge-c",
  "lounge-e",
  "mission-c",
  "mission-w",
  "north-c",
  "south-c",
] as const;

export interface Point2D {
  x: number;
  z: number;
}

/** Nearest waypoint to a floor point (straight-line distance). */
export function nearestWaypoint(p: Point2D): Waypoint {
  let best: Waypoint | null = null;
  let bestD = Infinity;
  for (const w of Object.values(WAYPOINTS)) {
    const d = Math.hypot(w.x - p.x, w.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  // WAYPOINTS is non-empty by construction.
  return best as Waypoint;
}

/** BFS shortest path of waypoint ids from `fromId` to `toId` (inclusive). */
export function bfsPath(fromId: string, toId: string): string[] {
  if (fromId === toId) return [fromId];
  const prev = new Map<string, string | null>([[fromId, null]]);
  const queue: string[] = [fromId];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    const wp = WAYPOINTS[cur];
    if (!wp) continue;
    for (const nb of wp.neighbors) {
      if (prev.has(nb)) continue;
      prev.set(nb, cur);
      if (nb === toId) {
        // Reconstruct.
        const path = [toId];
        let at: string | null = cur;
        while (at !== null) {
          path.unshift(at);
          at = prev.get(at) ?? null;
        }
        return path;
      }
      queue.push(nb);
    }
  }
  return []; // unreachable
}

/**
 * Full walking path from `from` to `to`: nearest waypoint to `from`,
 * BFS hops, then the exact destination. Duplicate consecutive points are
 * collapsed. Returns [] only if the graph has no route.
 */
export function findPath(from: Point2D, to: Point2D): Point2D[] {
  const fromW = nearestWaypoint(from);
  const toW = nearestWaypoint(to);
  const hopIds = bfsPath(fromW.id, toW.id);
  if (hopIds.length === 0) return [];
  const pts: Point2D[] = hopIds.map((id) => {
    const w = WAYPOINTS[id];
    return { x: w.x, z: w.z };
  });
  // Collapse a leading hop that is basically where we already stand, and
  // always finish exactly on the destination.
  const out: Point2D[] = [];
  for (const p of pts) {
    const last = out[out.length - 1] ?? from;
    if (Math.hypot(p.x - last.x, p.z - last.z) > 0.4) out.push(p);
  }
  const last = out[out.length - 1] ?? from;
  if (Math.hypot(to.x - last.x, to.z - last.z) > 0.4) {
    out.push({ x: to.x, z: to.z });
  } else if (out.length > 0) {
    out[out.length - 1] = { x: to.x, z: to.z };
  } else {
    out.push({ x: to.x, z: to.z });
  }
  return out;
}

/** Straight-line distance of a path (for tests / ETA estimates). */
export function pathLength(path: Point2D[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
  }
  return total;
}
