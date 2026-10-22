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
 *
 * Layout 2026-10-22 (user's dream-office denah): L1 north band =
 * meeting | server | pantry | restroom (doors open south into the
 * workspace/project); mid-left = project; center = workspace (8 desks +
 * hot-desk bullpen annex to the south); bottom-left = reception (main
 * entrance); east side = open stair lobby to the stair tower.
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

/** Bidirectional link helper: every neighbor pair lists each other. */
type WP = [id: string, x: number, z: number, neighbors: string[]];

function buildWaypoints(list: WP[]): Record<string, Waypoint> {
  const out: Record<string, Waypoint> = {};
  for (const [id, x, z, neighbors] of list) out[id] = { id, x, z, neighbors };
  return out;
}

export const WAYPOINTS: Record<string, Waypoint> = buildWaypoints([
  // Aisle between the two desk rows (z=1).
  ["aisle-w", -9, 1, ["aisle-wc", "s-w", "n-w", "proj-e"]],
  ["aisle-wc", -5, 1, ["aisle-w", "aisle-c"]],
  ["aisle-c", 0, 1, ["aisle-wc", "aisle-ec", "n-c"]],
  ["aisle-ec", 5, 1, ["aisle-c", "aisle-e"]],
  ["aisle-e", 9, 1, ["aisle-ec", "s-e", "n-e", "ws-e"]],
  // North walkway (z=-3.5), inside the workspace's north edge.
  ["n-w", -9, -3.5, ["n-wc", "aisle-w"]],
  ["n-wc", -6.5, -3.5, ["n-w", "n-c", "server-in"]],
  ["n-c", 0, -3.5, ["n-wc", "n-ec", "aisle-c"]],
  ["n-ec", 2, -3.5, ["n-c", "n-e", "pantry-in"]],
  ["n-e", 9, -3.5, ["n-ec", "aisle-e", "rest-in"]],
  // South walkway (z=5.3), between the desks and the bullpen annex.
  ["s-w", -9, 5.3, ["s-c", "aisle-w"]],
  ["s-c", 0, 5.3, ["s-w", "s-e", "bull-n"]],
  ["s-e", 9, 5.3, ["s-c", "aisle-e"]],
  // North-band room doors (open south into workspace / project).
  ["server-in", -6.5, -9.5, ["n-wc"]],
  ["pantry-in", 2, -9.5, ["n-ec"]],
  ["rest-in", 9, -9.5, ["n-e", "rest-e"]],
  ["rest-e", 12.5, -9, ["rest-in", "lob-n"]],
  ["meet-in", -15, -9.5, ["meet-out"]],
  ["meet-out", -15, -3.5, ["meet-in", "proj-w"]],
  // Project room (mid-left): meeting door (north) + workspace door (east).
  ["proj-w", -15, 0, ["meet-out", "proj-e"]],
  ["proj-e", -11, 0.5, ["proj-w", "aisle-w"]],
  // Hot-desk bullpen annex (x -8..8, z 6..14): north corridor + side aisles.
  ["bull-nw", -7.7, 7, ["bull-n", "bull-w"]],
  ["bull-n", 0, 7, ["bull-nw", "bull-ne", "s-c"]],
  ["bull-ne", 7.7, 7, ["bull-n", "bull-e"]],
  ["bull-w", -7.7, 10, ["bull-nw", "recep-e"]],
  ["bull-e", 7.7, 10, ["bull-ne", "lob-w"]],
  // Reception (bottom-left): east door into the bullpen annex.
  ["recep-in", -15, 10, ["recep-e"]],
  ["recep-e", -10.5, 10, ["recep-in", "bull-w"]],
  // East stair lobby (open): restroom door, workspace door, stair tower.
  ["lob-n", 15, -9, ["rest-e", "lob-c"]],
  ["lob-c", 15, 2, ["lob-n", "lob-s", "stair-door-g", "ws-e"]],
  ["lob-s", 15, 10, ["lob-c", "lob-w"]],
  ["lob-w", 11, 10, ["lob-s", "bull-e"]],
  ["ws-e", 11, 1, ["aisle-e", "lob-c"]],
  // Stair tower ground door (the chain itself lives in WAYPOINTS_UPPER).
  ["stair-door-g", 19.5, 2, ["lob-c", "stair-base"]],
]);

/** Waypoint ids agents may wander to while idle (open, pleasant spots). */
export const WANDER_WAYPOINT_IDS = [
  "recep-in",
  "pantry-in",
  "n-c",
  "s-c",
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

/** Extra waypoints for the second floor and stair tower (denah 2026-10-22).
 *
 * L2 rooms: north band = direksi | konten | musola (doors south into the
 * lounge, except musola which opens east into the north landing); mid-left
 * = fokus (door east into the lounge, door south into pemulihan); center =
 * lounge (the hub); bottom-left = pemulihan (doors east into the garden
 * hall, north into fokus); bottom-right = rnd (doors west into the garden
 * hall, east into the south-east lobby). The stair tower on the east side
 * feeds the stair lobby, which fans out to the lounge, the north landing,
 * and the south-east lobby.
 */
export const WAYPOINTS_UPPER: Record<string, Waypoint> = {
  // ---- Stair tower (x 20..24, z -2..6) ----
  "stair-base":   { id: "stair-base",   x: 22, z: 2, y: 0, floor: 0, neighbors: ["stair-door-g", "stair-mid"] },
  "stair-mid":    { id: "stair-mid",    x: 22, z: 2, y: FLOOR_HEIGHT / 2, neighbors: ["stair-base", "stair-top"] },
  "stair-top":    { id: "stair-top",    x: 22, z: 2, y: FLOOR_HEIGHT, floor: 1, neighbors: ["stair-mid", "stair-door-2"] },
  "stair-door-2": { id: "stair-door-2", x: 19.5, z: 4.5, y: FLOOR_HEIGHT, floor: 1, neighbors: ["stair-top", "u-lob-e"] },
  // ---- East stair lobby (x 6..20, z -4..5) ----
  "u-lob-e": { id: "u-lob-e", x: 17, z: 4.5, y: FLOOR_HEIGHT, floor: 1, neighbors: ["stair-door-2", "u-lob", "u-lob-se"] },
  "u-lob":   { id: "u-lob",   x: 14, z: 2.5, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-lob-e", "u-lob-w", "u-land-s"] },
  "u-lob-w": { id: "u-lob-w", x: 10, z: 1,   y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-lob", "u-lounge-e"] },
  // ---- North landing (x 13..20, z -14..-4) ----
  "u-land-s": { id: "u-land-s", x: 16, z: -2, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-lob", "u-land"] },
  "u-land":   { id: "u-land",   x: 16, z: -9, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-land-s", "u-musola"] },
  "u-musola": { id: "u-musola", x: 10, z: -9, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-land"] },
  // ---- Lounge (center hub, x -12..6, z -4..5) ----
  "u-lounge":    { id: "u-lounge",    x: -2,  z: 0.5,  y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-lounge-e", "u-lounge-w", "u-lounge-n1", "u-lounge-n2", "u-lounge-s"] },
  "u-lounge-e":  { id: "u-lounge-e",  x: 7.5, z: 0.5,  y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-lounge", "u-lob-w"] },
  "u-lounge-w":  { id: "u-lounge-w",  x: -9,  z: 0.5,  y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-lounge", "u-fokus"] },
  "u-lounge-n1": { id: "u-lounge-n1", x: -10, z: -2.5, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-lounge", "u-direksi"] },
  "u-lounge-n2": { id: "u-lounge-n2", x: -3,  z: -2.5, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-lounge", "u-konten"] },
  "u-lounge-s":  { id: "u-lounge-s",  x: -4,  z: 3,    y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-lounge", "u-hall"] },
  // ---- North-band room spurs ----
  "u-direksi": { id: "u-direksi", x: -13, z: -8, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-lounge-n1"] },
  "u-konten":  { id: "u-konten",  x: -3,  z: -8, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-lounge-n2"] },
  // ---- Fokus (mid-left) ----
  "u-fokus":   { id: "u-fokus",   x: -16, z: 0,   y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-lounge-w", "u-fokus-s"] },
  "u-fokus-s": { id: "u-fokus-s", x: -16, z: 3.5, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-fokus", "u-pem-n"] },
  // ---- Pemulihan (bottom-left): via fokus (north) or garden hall (east) ----
  "u-pem-n": { id: "u-pem-n", x: -16, z: 6.5, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-fokus-s", "u-pem"] },
  "u-pem":   { id: "u-pem",   x: -14, z: 9,   y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-pem-n", "u-hall"] },
  // ---- Garden hall (x -9..1, z 5..14, open indoor garden) ----
  "u-hall": { id: "u-hall", x: -4, z: 9, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-pem", "u-lounge-s", "u-rnd-w"] },
  // ---- R&D (bottom-right) ----
  "u-rnd-w": { id: "u-rnd-w", x: 3,  z: 9, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-hall", "u-rnd"] },
  "u-rnd":   { id: "u-rnd",   x: 10, z: 9, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-rnd-w", "u-rnd-e"] },
  "u-rnd-e": { id: "u-rnd-e", x: 15, z: 9, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-rnd", "u-lob-se"] },
  // ---- South-east lobby (x 16..20, z 5..14) ----
  "u-lob-se": { id: "u-lob-se", x: 18, z: 9, y: FLOOR_HEIGHT, floor: 1, neighbors: ["u-rnd-e", "u-lob-e"] },
};

/** Stair chain used when crossing floors (fixed order, base→top). */
export const STAIR_CHAIN_UP = ["stair-base", "stair-mid", "stair-top"] as const;
export const STAIR_CHAIN_DOWN = ["stair-top", "stair-mid", "stair-base"] as const;

/** Waypoint ids agents may wander to while idle (now includes upstairs). */
export const WANDER_WAYPOINT_IDS_2F = [
  "u-lounge",
  "u-hall",
  "u-land",
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
