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

/** Extra waypoints for the second floor, stair tower, and new ground rooms. */
export const WAYPOINTS_UPPER: Record<string, Waypoint> = {
  // ---- Stair tower (x 20..24, z -2..6) ----
  "stair-door-g": { id: "stair-door-g", x: 19.5, z: 2, floor: 0, neighbors: ["east-c", "stair-base"] },
  "stair-base":   { id: "stair-base",   x: 22, z: 2, y: 0, floor: 0, neighbors: ["stair-door-g", "stair-mid"] },
  "stair-mid":    { id: "stair-mid",    x: 22, z: 2, y: 1.75, neighbors: ["stair-base", "stair-top"] },
  "stair-top":    { id: "stair-top",    x: 22, z: 2, y: 3.5, floor: 1, neighbors: ["stair-mid", "stair-door-2"] },
  "stair-door-2": { id: "stair-door-2", x: 19.5, z: 4.5, y: 3.5, floor: 1, neighbors: ["stair-top", "L2-cw17e"] },
  // ---- Upper south corridor (z=4.75) chain, aligned with room doors ----
  "L2-cw17":  { id: "L2-cw17",  x: -17, z: 4.75, y: 3.5, floor: 1, neighbors: ["L2-cw10", "L2-focus1"] },
  "L2-cw10":  { id: "L2-cw10",  x: -10, z: 4.75, y: 3.5, floor: 1, neighbors: ["L2-cw17", "L2-cw6", "L2-focus2", "L2-train-door"] },
  "L2-cw6":   { id: "L2-cw6",   x: -6,  z: 4.75, y: 3.5, floor: 1, neighbors: ["L2-cw10", "L2-cw4", "L2-linkW-n", "L2-pmeet1"] },
  "L2-cw4":   { id: "L2-cw4",   x: 4,   z: 4.75, y: 3.5, floor: 1, neighbors: ["L2-cw6", "L2-cw75", "L2-pmeet2"] },
  "L2-cw75":  { id: "L2-cw75",  x: 7.5, z: 4.75, y: 3.5, floor: 1, neighbors: ["L2-cw4", "L2-cw14", "L2-linkE-n"] },
  "L2-cw14":  { id: "L2-cw14",  x: 14,  z: 4.75, y: 3.5, floor: 1, neighbors: ["L2-cw75", "L2-cw17e", "L2-lounge", "L2-terr-door"] },
  "L2-cw17e": { id: "L2-cw17e", x: 17,  z: 4.75, y: 3.5, floor: 1, neighbors: ["L2-cw14", "stair-door-2"] },
  // ---- Room spurs (doors on the corridor's north edge, z=3.5) ----
  "L2-focus1": { id: "L2-focus1", x: -17, z: 0, y: 3.5, floor: 1, neighbors: ["L2-cw17"] },
  "L2-focus2": { id: "L2-focus2", x: -10, z: 0, y: 3.5, floor: 1, neighbors: ["L2-cw10"] },
  "L2-pmeet1": { id: "L2-pmeet1", x: -3,  z: 0, y: 3.5, floor: 1, neighbors: ["L2-cw6"] },
  "L2-pmeet2": { id: "L2-pmeet2", x: 4,   z: 0, y: 3.5, floor: 1, neighbors: ["L2-cw4"] },
  "L2-lounge": { id: "L2-lounge", x: 14,  z: 0, y: 3.5, floor: 1, neighbors: ["L2-cw14"] },
  // ---- Vertical links to the north corridor ----
  "L2-linkW-n": { id: "L2-linkW-n", x: -6, z: 4.75, y: 3.5, floor: 1, neighbors: ["L2-cw6", "L2-linkW-m"] },
  "L2-linkW-m": { id: "L2-linkW-m", x: -6, z: -0.75, y: 3.5, floor: 1, neighbors: ["L2-linkW-n", "L2-linkW-s"] },
  "L2-linkW-s": { id: "L2-linkW-s", x: -6, z: -6, y: 3.5, floor: 1, neighbors: ["L2-linkW-m", "L2-ncorr-c"] },
  "L2-linkE-n": { id: "L2-linkE-n", x: 7.5, z: 4.75, y: 3.5, floor: 1, neighbors: ["L2-cw75", "L2-linkE-m"] },
  "L2-linkE-m": { id: "L2-linkE-m", x: 7.5, z: -0.75, y: 3.5, floor: 1, neighbors: ["L2-linkE-n", "L2-linkE-s"] },
  "L2-linkE-s": { id: "L2-linkE-s", x: 7.5, z: -6, y: 3.5, floor: 1, neighbors: ["L2-linkE-m", "L2-ncorr-e"] },
  // ---- North corridor (z=-6) chain + room spurs ----
  "L2-ncorr-w": { id: "L2-ncorr-w", x: -17, z: -6, y: 3.5, floor: 1, neighbors: ["L2-ncorr-c", "L2-exec"] },
  "L2-ncorr-c": { id: "L2-ncorr-c", x: 0,   z: -6, y: 3.5, floor: 1, neighbors: ["L2-ncorr-w", "L2-ncorr-e", "L2-linkW-s", "L2-lab"] },
  "L2-ncorr-e": { id: "L2-ncorr-e", x: 17,  z: -6, y: 3.5, floor: 1, neighbors: ["L2-ncorr-c", "L2-linkE-s", "L2-studio"] },
  "L2-exec":   { id: "L2-exec",   x: -14, z: -9.5, y: 3.5, floor: 1, neighbors: ["L2-ncorr-w"] },
  "L2-lab":    { id: "L2-lab",    x: 0,   z: -9.5, y: 3.5, floor: 1, neighbors: ["L2-ncorr-c"] },
  "L2-studio": { id: "L2-studio", x: 14,  z: -9.5, y: 3.5, floor: 1, neighbors: ["L2-ncorr-e"] },
  // ---- Training room + terrace (doors on the corridor's south edge, z=6) ----
  "L2-train-door": { id: "L2-train-door", x: -10, z: 6, y: 3.5, floor: 1, neighbors: ["L2-cw10", "L2-train-in"] },
  "L2-train-in":   { id: "L2-train-in",   x: -13, z: 10, y: 3.5, floor: 1, neighbors: ["L2-train-door"] },
  "L2-terr-door":  { id: "L2-terr-door",  x: 14, z: 6, y: 3.5, floor: 1, neighbors: ["L2-cw14", "L2-terr-in"] },
  "L2-terr-in":    { id: "L2-terr-in",    x: 8,  z: 10, y: 3.5, floor: 1, neighbors: ["L2-terr-door"] },
  // ---- New ground-floor room spurs ----
  "south-r":   { id: "south-r",   x: 14, z: 7, floor: 0, neighbors: ["south-e", "recep-in"] },
  "recep-in":  { id: "recep-in",  x: 14, z: 11, floor: 0, neighbors: ["south-r"] },
  "north-p":   { id: "north-p",   x: 7, z: -4.5, floor: 0, neighbors: ["north-ec", "north-e", "pantry-in"] },
  "pantry-in": { id: "pantry-in", x: 7, z: -9.5, floor: 0, neighbors: ["north-p"] },
  "north-sv":  { id: "north-sv",  x: -5.5, z: -4.5, floor: 0, neighbors: ["north-wc", "north-c", "server-in"] },
  "server-in": { id: "server-in", x: -5.5, z: -9.5, floor: 0, neighbors: ["north-sv"] },
  "north-r":   { id: "north-r",   x: 0.5, z: -4.5, floor: 0, neighbors: ["north-c", "rest-in"] },
  "rest-in":   { id: "rest-in",   x: 0.5, z: -9.5, floor: 0, neighbors: ["north-r"] },
  "north-pm":  { id: "north-pm",  x: 11, z: -4.5, floor: 0, neighbors: ["north-e", "pm-door"] },
  "pm-door":   { id: "pm-door",   x: 11, z: -9.5, floor: 0, neighbors: ["north-pm", "pm-in"] },
  "pm-in":     { id: "pm-in",     x: 15.5, z: -9.5, floor: 0, neighbors: ["pm-door"] },
  "west-r":    { id: "west-r",    x: -13, z: 1, floor: 0, neighbors: ["west-c", "rec-door"] },
  "rec-door":  { id: "rec-door",  x: -13, z: 0.5, floor: 0, neighbors: ["west-r", "rec-in"] },
  "rec-in":    { id: "rec-in",    x: -16.5, z: 0.5, floor: 0, neighbors: ["rec-door"] },
};

/** Stair chain used when crossing floors (fixed order, base→top). */
export const STAIR_CHAIN_UP = ["stair-base", "stair-mid", "stair-top"] as const;
export const STAIR_CHAIN_DOWN = ["stair-top", "stair-mid", "stair-base"] as const;

/** Waypoint ids agents may wander to while idle (now includes upstairs + terrace). */
export const WANDER_WAYPOINT_IDS_2F = [
  "L2-lounge",
  "L2-terr-in",
  "L2-cw14",
  "recep-in",
] as const;

function allWaypoints(): Record<string, Waypoint> {
  // Reverse links from the original ground graph into the new spurs/tower.
  // (The WAYPOINTS literal itself stays pristine so the original 2D tests
  // and ground-only findPath keep their exact behavior.)
  const extraNeighbors: Record<string, string[]> = {
    "south-e": ["south-r"],
    "east-c": ["stair-door-g"],
    "north-ec": ["north-p"],
    "north-e": ["north-pm"],
    "north-wc": ["north-sv"],
    "north-c": ["north-sv", "north-r"],
    "west-c": ["west-r"],
  };
  const merged: Record<string, Waypoint> = {};
  for (const [id, w] of Object.entries(WAYPOINTS)) {
    const extra = extraNeighbors[id];
    merged[id] = extra ? { ...w, neighbors: [...w.neighbors, ...extra] } : w;
  }
  for (const [id, w] of Object.entries(WAYPOINTS_UPPER)) {
    merged[id] = w;
  }
  return merged;
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
  const finishY = to.floor === 1 ? 3.5 : 0;
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
