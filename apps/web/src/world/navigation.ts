/**
 * Waypoint navigation graph for the single-floor office.
 *
 * The office is mostly open space with furniture footprints to avoid
 * (desk rows, meeting table). Instead of a full nav-mesh, we
 * hand-place waypoints in open corridors and connect them explicitly —
 * simple, deterministic, and easy to extend.
 *
 * Collision awareness (2026-10-23):
 * - `findPath` picks the nearest waypoint *in the same zone* as each
 *   endpoint (zone = room id from floorPlan.roomAt, or null for open
 *   space). Because the graph routes through door waypoints
 *   ("musola-in" inside, "cor-musola" outside, ...), same-zone selection
 *   forces paths through doors instead of through walls.
 * - Straight legs (endpoint ↔ waypoint) are validated against circular
 *   furniture obstacles (`segmentBlocked`, agent radius 0.35). If the
 *   nearest same-zone waypoint is blocked, the next-nearest clear one is
 *   used; if none is clear, the nearest is kept (best effort).
 * - Obstacles that contain an endpoint are ignored, so agents can start
 *   at / arrive at furniture (e.g. walk up to their desk).
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

import { roomAt } from "./building/floorPlan";

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

// ---------------------------------------------------------------------------
// Furniture obstacles (circles on the floor plane).
//
// Positions mirror the room components (Workspace, Reception, MeetingRoom,
// Pantry, ServerRoom, RecoveryRoom, ProjectRoom). Radii approximate the
// furniture footprint; `segmentBlocked` adds AGENT_RADIUS on top.
// ---------------------------------------------------------------------------

export interface Obstacle {
  /** Stable id for debugging / tests. */
  id: string;
  x: number;
  z: number;
  r: number;
}

/** Agent body radius (world units) added to every obstacle radius. */
export const AGENT_RADIUS = 0.35;

const DESK_XS = [-4, -2, 2, 4];
const DESK_ZS = [-1.3, 1.3];

export const OBSTACLES: Obstacle[] = [
  // 8 workspace desks (1.7 × 0.85) — Workspace.tsx / floorPlan WORKSTATIONS
  ...DESK_XS.flatMap((x) =>
    DESK_ZS.map((z, zi): Obstacle => ({
      id: `desk-${x}-${zi}`,
      x,
      z,
      r: 1.0,
    })),
  ),
  // Lobby: pink sofa (2.0 × 0.9) + round coffee table (r≈1.1) — Reception.tsx
  { id: "lobby-sofa", x: 6.5, z: 6.5, r: 1.2 },
  { id: "lobby-coffee-table", x: 6.5, z: 8.2, r: 1.1 },
  // Reception counter (3.8 × 1.1) — Reception.tsx
  { id: "reception-counter", x: 0, z: 7.4, r: 1.5 },
  // Meeting table (2.4 × 5.0) — MeetingRoom.tsx (moderate radius: the
  // table ends stay walkable, the middle is blocked)
  { id: "meeting-table", x: 12.8, z: 4.4, r: 2.0 },
  // Pantry: counter (4.8 × 0.65) + round dining table (r≈1.6) — Pantry.tsx
  { id: "pantry-counter", x: 4.2, z: -11.4, r: 2.0 },
  { id: "pantry-table", x: 4.2, z: -7.5, r: 1.2 },
  // Server racks (0.9 × 0.8) — ServerRoom.tsx SERVER_RACKS
  { id: "server-rack-0", x: 13.8, z: -10, r: 0.6 },
  { id: "server-rack-1", x: 13.8, z: -8.5, r: 0.6 },
  { id: "server-rack-2", x: 13.8, z: -7, r: 0.6 },
  // Recovery beds (1.05 × 2.1) — floorPlan RECOVERY_BEDS
  { id: "recovery-bed-0", x: -7.3, z: -10.8, r: 1.1 },
  { id: "recovery-bed-1", x: -5.45, z: -10.8, r: 1.1 },
  { id: "recovery-bed-2", x: -3.6, z: -10.8, r: 1.1 },
  { id: "recovery-bed-3", x: -1.75, z: -10.8, r: 1.1 },
  // Project room discussion table (1.8 × 0.9) — ProjectRoom.tsx
  { id: "project-table", x: -11.5, z: 5.5, r: 1.1 },
];

/** Distance from point p to the segment a→b (floor plane). */
function distPointToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const lenSq = abx * abx + abz * abz;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.z - a.z);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / lenSq),
  );
  return Math.hypot(p.x - (a.x + t * abx), p.z - (a.z + t * abz));
}

/**
 * True when the straight segment a→b passes within (r + AGENT_RADIUS) of
 * any furniture obstacle. Obstacles containing either endpoint are
 * ignored so agents can start at / walk up to furniture (e.g. their desk).
 */
export function segmentBlocked(a: Point2D, b: Point2D): boolean {
  for (const o of OBSTACLES) {
    if (Math.hypot(a.x - o.x, a.z - o.z) < o.r) continue;
    if (Math.hypot(b.x - o.x, b.z - o.z) < o.r) continue;
    if (distPointToSegment(o, a, b) < o.r + AGENT_RADIUS) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Zone-aware waypoint selection.
//
// A "zone" is the room id containing a point (floorPlan.roomAt), or null
// for open space (corridor / gaps between rooms). Picking the nearest
// waypoint in the SAME zone as the endpoint keeps the straight first/last
// legs inside one convex room — they cannot cross a wall — and the BFS
// middle is forced to route through the room's door waypoints.
// ---------------------------------------------------------------------------

/** Zone id of a floor point: room id, or null for open space. */
export function zoneOf(p: Point2D): string | null {
  return roomAt(p.x, p.z, 0)?.id ?? null;
}

/** Precomputed zone for every waypoint. */
const WAYPOINT_ZONES: Record<string, string | null> = Object.fromEntries(
  Object.values(WAYPOINTS).map((w) => [w.id, zoneOf(w)]),
);

/**
 * Nearest waypoint in the same zone as `p`, preferring one whose straight
 * segment from `p` is not blocked by furniture. Falls back to the global
 * nearest waypoint when the zone has none (best effort, never throws).
 */
export function nearestWaypointInZone(p: Point2D): Waypoint {
  const zone = zoneOf(p);
  const sameZone = Object.values(WAYPOINTS).filter(
    (w) => WAYPOINT_ZONES[w.id] === zone,
  );
  const pool = sameZone.length > 0 ? sameZone : Object.values(WAYPOINTS);
  const sorted = [...pool].sort(
    (w1, w2) =>
      Math.hypot(w1.x - p.x, w1.z - p.z) - Math.hypot(w2.x - p.x, w2.z - p.z),
  );
  for (const w of sorted) {
    if (!segmentBlocked(p, w)) return w;
  }
  return sorted[0]; // WAYPOINTS is non-empty by construction.
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
 * Full walking path from `from` to `to`: nearest same-zone waypoint to
 * `from` (collision-aware), BFS hops, then the exact destination.
 * Duplicate consecutive points are collapsed. Returns [] only if the
 * graph has no route.
 */
export function findPath(from: Point2D, to: Point2D): Point2D[] {
  const fromW = nearestWaypointInZone(from);
  const toW = nearestWaypointInZone(to);
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
