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
  /** Height of this waypoint (second floor / stairs). Defaults to 0. */
  y?: number;
  /** Floor index: 0 = ground, 1 = second. Defaults to 0. */
  floor?: 0 | 1;
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
  "north-wc": { id: "north-wc", x: -5, z: -4.5, neighbors: ["north-w", "north-c", "north-sv"] },
  "north-c":  { id: "north-c",  x: 0,  z: -4.5, neighbors: ["north-wc", "north-ec", "north-sv", "north-r"] },
  "north-ec": { id: "north-ec", x: 5,  z: -4.5, neighbors: ["north-c", "north-e", "north-p"] },
  "north-e":  { id: "north-e",  x: 9,  z: -4.5, neighbors: ["north-ec", "east-n", "north-p"] },
  // South corridor (z=7), between workspace and the reception/overflow zone.
  "south-w":  { id: "south-w",  x: -9, z: 7, neighbors: ["south-wc", "west-s"] },
  "south-wc": { id: "south-wc", x: -5, z: 7, neighbors: ["south-w", "south-c"] },
  "south-c":  { id: "south-c",  x: 0,  z: 7, neighbors: ["south-wc", "south-ec"] },
  "south-ec": { id: "south-ec", x: 5,  z: 7, neighbors: ["south-c", "south-e"] },
  "south-e":  { id: "south-e",  x: 9,  z: 7, neighbors: ["south-ec", "east-s", "south-r"] },
  // West corridor (x=-12) linking north/aisle/south around the desk block.
  "west-n": { id: "west-n", x: -12, z: -4.5, neighbors: ["north-w", "west-c"] },
  "west-c": { id: "west-c", x: -12, z: 1,    neighbors: ["west-n", "west-s", "aisle-w", "west-r"] },
  "west-s": { id: "west-s", x: -12, z: 7,    neighbors: ["west-c", "south-w"] },
  // East corridor (x=12).
  "east-n": { id: "east-n", x: 12, z: -4.5, neighbors: ["north-e", "east-c"] },
  "east-c": { id: "east-c", x: 12, z: 1,    neighbors: ["east-n", "east-s", "aisle-e", "stair-door-g"] },
  "east-s": { id: "east-s", x: 12, z: 7,    neighbors: ["east-c", "south-e"] },
  // Meeting room spur (through the glass partition — treated as a doorway).
  "meet-out": { id: "meet-out", x: -7, z: -9.5, neighbors: ["north-w", "meet-in"] },
  "meet-in":  { id: "meet-in",  x: -10, z: -9.5, neighbors: ["meet-out"] },
  // Room spurs (doors into the north/south rooms and the stair tower).
  "south-r":   { id: "south-r",   x: 14, z: 7, floor: 0, neighbors: ["south-e", "recep-in"] },
  "recep-in":  { id: "recep-in",  x: 14, z: 11, floor: 0, neighbors: ["south-r"] },
  "north-p":   { id: "north-p",   x: 7, z: -4.5, floor: 0, neighbors: ["north-ec", "north-e", "pantry-in"] },
  "pantry-in": { id: "pantry-in", x: 7, z: -9.5, floor: 0, neighbors: ["north-p"] },
  "north-sv":  { id: "north-sv",  x: -5.5, z: -4.5, floor: 0, neighbors: ["north-wc", "north-c", "server-in"] },
  "server-in": { id: "server-in", x: -5.5, z: -9.5, floor: 0, neighbors: ["north-sv"] },
  "north-r":   { id: "north-r",   x: 0.5, z: -4.5, floor: 0, neighbors: ["north-c", "rest-in"] },
  "rest-in":   { id: "rest-in",   x: 0.5, z: -9.5, floor: 0, neighbors: ["north-r"] },
  "west-r":    { id: "west-r",    x: -13, z: 1, floor: 0, neighbors: ["west-c", "rec-door"] },
  "rec-door":  { id: "rec-door",  x: -13, z: 0.5, floor: 0, neighbors: ["west-r", "rec-in"] },
  "rec-in":    { id: "rec-in",    x: -16.5, z: 0.5, floor: 0, neighbors: ["rec-door"] },
};

/** Waypoint ids agents may wander to while idle (open, pleasant spots). */
export const WANDER_WAYPOINT_IDS = [
  "recep-in",
  "pantry-in",
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

/* ---------------------------------------------------------------------------
 * Second floor + stair tower (two-story building extension).
 *
 * Waypoints carry an optional `floor` (default 0) and `y` (height). The
 * stair tower on the east facade (x 20..24, z -2..6) links the floors via
 * the fixed chain stair-base → stair-mid → stair-top. `findPath3D` routes
 * within one floor with the ordinary BFS, and across floors by stitching:
 *   from → stair entry (same floor) → stair chain → stair exit → to.
 * `findPath` (2D, ground floor) is unchanged for backward compatibility.
 * ------------------------------------------------------------------------- */

import { FLOOR_HEIGHT } from "./building/floorPlan";

/** Extra waypoints for the second floor, stair tower, and new ground rooms. */
export const WAYPOINTS_UPPER: Record<string, Waypoint> = {
  // ---- Stair tower (x 20..24, z -2..6) ----
  "stair-door-g": { id: "stair-door-g", x: 19.5, z: 2, floor: 0, neighbors: ["east-c", "stair-base"] },
  "stair-base":   { id: "stair-base",   x: 22, z: 2, y: 0, floor: 0, neighbors: ["stair-door-g", "stair-mid"] },
  "stair-mid":    { id: "stair-mid",    x: 22, z: 2, y: FLOOR_HEIGHT / 2, neighbors: ["stair-base", "stair-top"] },
  "stair-top":    { id: "stair-top",    x: 22, z: 2, y: FLOOR_HEIGHT, floor: 1, neighbors: ["stair-mid", "stair-door-2"] },
  "stair-door-2": { id: "stair-door-2", x: 19.5, z: 4.5, y: FLOOR_HEIGHT, floor: 1, neighbors: ["stair-top", "u-cw18e"] },
  // ---- Upper corridor (z=4.75) chain, x -18..18 ----
  "u-cw18":  { id: "u-cw18",  x: -18, z: 4.75, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-cw14"] },
  "u-cw14":  { id: "u-cw14",  x: -14, z: 4.75, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-cw18", "u-cw10", "u-focus"] },
  "u-cw10":  { id: "u-cw10",  x: -10, z: 4.75, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-cw14", "u-cw6", "u-musola"] },
  "u-cw6":   { id: "u-cw6",   x: -6,  z: 4.75, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-cw10", "u-cw2"] },
  "u-cw2":   { id: "u-cw2",   x: -2,  z: 4.75, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-cw6", "u-cw2e"] },
  "u-cw2e":  { id: "u-cw2e",  x: 2,   z: 4.75, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-cw2", "u-cw6e", "u-studio"] },
  "u-cw6e":  { id: "u-cw6e",  x: 6,   z: 4.75, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-cw2e", "u-cw10e"] },
  "u-cw10e": { id: "u-cw10e", x: 10,  z: 4.75, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-cw6e", "u-cw14e"] },
  "u-cw14e": { id: "u-cw14e", x: 14,  z: 4.75, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-cw10e", "u-cw18e", "u-lounge"] },
  "u-cw18e": { id: "u-cw18e", x: 18,  z: 4.75, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-cw14e", "stair-door-2"] },
  // ---- Room spurs (doors on the corridor's north/south edges) ----
  "u-focus":  { id: "u-focus",  x: -14, z: 10, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-cw14"] },
  "u-musola": { id: "u-musola", x: -10, z: 0,  y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-cw10"] },
  "u-studio": { id: "u-studio", x: 2,   z: 10, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-cw2e"] },
  "u-lounge": { id: "u-lounge", x: 14,  z: -2, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-cw14e"] },
};

/** Stair chain used when crossing floors (fixed order, base→top). */
export const STAIR_CHAIN_UP = ["stair-base", "stair-mid", "stair-top"] as const;
export const STAIR_CHAIN_DOWN = ["stair-top", "stair-mid", "stair-base"] as const;

/** Waypoint ids agents may wander to while idle (now includes upstairs). */
export const WANDER_WAYPOINT_IDS_2F = [
  "u-lounge",
  "u-musola",
  "recep-in",
] as const;

function allWaypoints(): Record<string, Waypoint> {
  return { ...WAYPOINTS, ...WAYPOINTS_UPPER };
}

/** Exported for tests: the full merged graph as the movement system uses it. */
export function mergedWaypoints(): Record<string, Waypoint> {
  return allWaypoints();
}

function waypointFloor(w: Waypoint): 0 | 1 {
  return w.floor ?? 0;
}

function waypointY(w: Waypoint): number {
  return w.y ?? 0;
}

/** Nearest waypoint to a floor point, restricted to one floor. */
export function nearestWaypointOnFloor(p: Point2D, floor: 0 | 1): Waypoint {
  const all = allWaypoints();
  let best: Waypoint | null = null;
  let bestD = Infinity;
  for (const w of Object.values(all)) {
    if (waypointFloor(w) !== floor) continue;
    // Never route "through" the stair chain mid-landing as a nearest hop.
    if (w.id === "stair-mid") continue;
    const d = Math.hypot(w.x - p.x, w.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best as Waypoint;
}

function bfsOnFloor(fromId: string, toId: string, floor: 0 | 1): string[] {
  if (fromId === toId) return [fromId];
  const all = allWaypoints();
  const prev = new Map<string, string | null>([[fromId, null]]);
  const queue: string[] = [fromId];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    const wp = all[cur];
    if (!wp) continue;
    for (const nb of wp.neighbors) {
      const nw = all[nb];
      // Stay on the requested floor; the stair chain is stitched explicitly.
      if (!nw || waypointFloor(nw) !== floor) continue;
      if (prev.has(nb)) continue;
      prev.set(nb, cur);
      if (nb === toId) {
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
  return [];
}

export interface NavPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface FloorPoint extends Point2D {
  floor: 0 | 1;
}

function hopIdsTo3D(hopIds: string[]): NavPoint3D[] {
  const all = allWaypoints();
  return hopIds.map((id) => {
    const w = all[id];
    return { x: w.x, y: waypointY(w), z: w.z };
  });
}

/**
 * Full 3D walking path between floors-aware points. Same-floor routes use
 * the ordinary BFS on that floor's subgraph; cross-floor routes stitch
 * from → stair entry → stair chain → stair exit → to. Returns [] when no
 * route exists. Consecutive duplicates are collapsed and the path always
 * ends exactly on `to` (at the destination floor's height).
 */
export function findPath3D(from: FloorPoint, to: FloorPoint): NavPoint3D[] {
  const all = allWaypoints();
  const finishY = to.floor === 1 ? FLOOR_HEIGHT : 0;
  const pushDedup = (out: NavPoint3D[], p: NavPoint3D) => {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 0.4 || Math.abs(p.y - last.y) > 0.01) {
      out.push(p);
    }
  };

  if (from.floor === to.floor) {
    const fromW = nearestWaypointOnFloor(from, from.floor);
    const toW = nearestWaypointOnFloor(to, to.floor);
    const hops = bfsOnFloor(fromW.id, toW.id, from.floor);
    if (hops.length === 0) return [];
    const out: NavPoint3D[] = [];
    for (const p of hopIdsTo3D(hops)) pushDedup(out, p);
    pushDedup(out, { x: to.x, y: finishY, z: to.z });
    return out;
  }

  // Cross-floor: from → stair entry → chain → stair exit → to.
  const up = from.floor === 0;
  const entryId = up ? "stair-base" : "stair-top";
  const exitId = up ? "stair-top" : "stair-base";
  const fromW = nearestWaypointOnFloor(from, from.floor);
  const toW = nearestWaypointOnFloor(to, to.floor);
  const hops1 = bfsOnFloor(fromW.id, entryId, from.floor);
  const hops2 = bfsOnFloor(exitId, toW.id, to.floor);
  if (hops1.length === 0 || hops2.length === 0) return [];
  const chain = up ? STAIR_CHAIN_UP : STAIR_CHAIN_DOWN;
  const out: NavPoint3D[] = [];
  for (const p of hopIdsTo3D(hops1)) pushDedup(out, p);
  for (const id of chain) {
    const w = all[id];
    pushDedup(out, { x: w.x, y: waypointY(w), z: w.z });
  }
  for (const p of hopIdsTo3D(hops2)) pushDedup(out, p);
  pushDedup(out, { x: to.x, y: finishY, z: to.z });
  return out;
}

/** 3D path length (for tests / ETA estimates). */
export function pathLength3D(path: NavPoint3D[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y, path[i].z - path[i - 1].z);
  }
  return total;
}
