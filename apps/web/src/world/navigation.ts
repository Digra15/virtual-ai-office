/**
 * Waypoint navigation graph for the single-floor office.
 *
 * The office is mostly open space with furniture footprints to avoid
 * (desk rows, meeting table). Instead of a full nav-mesh, we
 * hand-place waypoints in open corridors and connect them explicitly —
 * simple, deterministic, and easy to extend.
 *
 * Conventions:
 * - All coordinates are floor-plane (x, z); y is always 0 (ONE floor).
 * - `findPath(from, to)` returns a list of {x,z} points: the nearest
 *   waypoint to `from`, BFS hops across the graph, then the exact `to`.
 * - Waypoints avoid desk/chair footprints; the final leg to a desk is a
 *   short straight segment from the nearest aisle waypoint.
 *
 * Layout 2026-10-23 (user's single-floor code, faithful):
 * - North band (z -12..-4.5): musola | recovery | pantry | toilet_pria |
 *   toilet_wanita | server. Doors open south into the corridor (z=-3.4).
 * - Corridor (z=-3.4) chains the 6 north-room doors west→east.
 * - Central aisle (x=0, z -1.5..4.5) threads between the desk columns
 *   (desks at x ±2/±4, rows z=∓1.3) down to the lobby.
 * - Project room (west): door on its east wall at (-6.5, 3.0), reached
 *   via the open west band (x -6.5..-0.5 is kept desk-free).
 * - Meeting room (east): door on its west wall at (9.5, 2.0), reached
 *   via ws-e (8.5,-2) → meet-out (8.5,2).
 * - Lobby (south): entrance door at (0,10).
 */

export interface Waypoint {
  id: string;
  x: number;
  z: number;
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
  // ---- North corridor (z=-3.4): serves the 6 north-band room doors ----
  ["cor-musola", -12.5, -3.4, ["cor-recovery", "musola-in"]],
  ["cor-recovery", -0.3, -3.4, ["cor-musola", "cor-pantry", "recovery-in", "aisle-n"]],
  ["cor-pantry", 1.8, -3.4, ["cor-recovery", "cor-tpria", "pantry-in", "aisle-n"]],
  ["cor-tpria", 8.8, -3.4, ["cor-pantry", "cor-twanita", "ws-e"]],
  ["cor-twanita", 10.8, -3.4, ["cor-tpria", "cor-server"]],
  ["cor-server", 13.2, -3.4, ["cor-twanita", "server-in"]],
  // ---- North-band room interior spurs (just inside each door) ----
  ["musola-in", -12.5, -7.5, ["cor-musola"]],
  ["recovery-in", -0.3, -7.5, ["cor-recovery"]],
  ["pantry-in", 1.8, -7.5, ["cor-pantry"]],
  ["server-in", 13.2, -7.5, ["cor-server"]],
  // ---- Central aisle (x=0): corridor → lobby, between the desk columns ----
  ["aisle-n", 0, -1.5, ["cor-recovery", "cor-pantry", "aisle-1"]],
  ["aisle-1", 0, 0.5, ["aisle-n", "aisle-2"]],
  ["aisle-2", 0, 2.5, ["aisle-1", "aisle-3", "proj-w"]],
  ["aisle-3", 0, 4.5, ["aisle-2", "lobby"]],
  // ---- Lobby (z 6..10): main entrance ----
  ["lobby", 0, 8, ["aisle-3", "entrance", "lobby-e"]],
  ["entrance", 0, 10, ["lobby"]],
  ["lobby-e", 6.5, 8, ["lobby"]],
  // ---- Project room: door on its east wall at (-6.5, 3.0) ----
  ["proj-w", -4.5, 3.2, ["aisle-2", "proj-door"]],
  ["proj-door", -6.5, 3.0, ["proj-w", "proj-in"]],
  ["proj-in", -11.5, 3.0, ["proj-door"]],
  // ---- Meeting room: door on its west wall at (9.5, 2.0) ----
  ["ws-e", 8.5, -2, ["cor-tpria", "meet-out"]],
  ["meet-out", 8.5, 2, ["ws-e", "meet-door"]],
  ["meet-door", 9.5, 2, ["meet-out", "meet-in"]],
  ["meet-in", 11.5, 2, ["meet-door"]],
]);

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

// ---------------------------------------------------------------------------
// 3D path shim (single floor).
//
// The building has ONE floor (y = 0 everywhere), so this is `findPath`
// with y: 0 attached to every point. Kept — with the FloorPoint signature
// — because movement.navigateToFloor still imports it; callers pass
// floor: 0 and the value is ignored.
// ---------------------------------------------------------------------------

export interface NavPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface FloorPoint extends Point2D {
  floor: 0 | 1;
}

/** Single-floor 3D path: same route as findPath, y always 0. */
export function findPath3D(from: FloorPoint, to: FloorPoint): NavPoint3D[] {
  return findPath(from, to).map((p) => ({ x: p.x, y: 0, z: p.z }));
}

/** 3D path length (for tests / ETA estimates). */
export function pathLength3D(path: NavPoint3D[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y, path[i].z - path[i - 1].z);
  }
  return total;
}
