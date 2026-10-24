/**
 * Waypoint navigation graph for the single-floor office.
 *
 * The office is mostly open space with furniture footprints to avoid
 * (desk rows, meeting table). Instead of a full nav-mesh, we
 * hand-place waypoints in open corridors and connect them explicitly —
 * simple, deterministic, and easy to extend.
 *
 * Collision awareness (2026-10-23, reworked 2026-10-24):
 * - `findPath` picks the nearest waypoint *in the same zone* as each
 *   endpoint (zone = room id from floorPlan.roomAt, or null for open
 *   space). Because the graph routes through door waypoints
 *   ("musola-in" inside, "cor-musola" outside, ...), same-zone selection
 *   forces paths through doors instead of through walls.
 * - Straight legs (endpoint ↔ waypoint) are validated against furniture
 *   obstacles (`segmentBlocked`, agent radius 0.35). If the
 *   nearest same-zone waypoint is blocked, the next-nearest clear one is
 *   used; if none is clear, the nearest is kept (best effort).
 * - Waypoint→waypoint middle legs are collision-repaired: a blocked leg
 *   gets a detour waypoint inserted (up to 8 insertions). First/last
 *   legs are NOT repaired — agents legitimately start at / arrive at
 *   furniture (desk chair, pantry chair, meeting seat).
 * - Obstacles are circles (round tables, chairs, plants) and
 *   axis-aligned boxes (desks, counters, tables, beds, racks, sofa,
 *   planters) matching the real footprints — a fat circle around the
 *   old reception counter used to swallow the lobby walkway.
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
 *   toilet_wanita | server. Doors open south into the corridor (z=-3.7).
 * - Corridor (z=-3.7) chains the 6 north-room doors west→east.
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
  // ---- North corridor (z=-3.7): serves the 6 north-band room doors.
  // z=-3.7 (not -3.4) so the corridor legs clear the planter strips
  // (north edge z=-3.2) by 0.5 > AGENT_RADIUS.
  ["cor-musola", -12.5, -3.7, ["cor-recovery", "musola-in"]],
  ["cor-recovery", -0.3, -3.7, ["cor-musola", "cor-pantry", "recovery-in", "aisle-n"]],
  ["cor-pantry", 1.8, -3.7, ["cor-recovery", "cor-tpria", "pantry-in", "aisle-n"]],
  ["cor-tpria", 8.8, -3.7, ["cor-pantry", "cor-twanita", "ws-e"]],
  ["cor-twanita", 10.8, -3.7, ["cor-tpria", "cor-server"]],
  ["cor-server", 13.2, -3.7, ["cor-twanita", "server-in"]],
  // ---- North-band room interior spurs (just inside each door) ----
  ["musola-in", -12.5, -7.5, ["cor-musola"]],
  ["recovery-in", -0.3, -7.5, ["cor-recovery"]],
  ["pantry-in", 1.8, -7.5, ["cor-pantry"]],
  // server-in jogs west (12.6) so the leg clears the server-rack boxes
  // hugging the east wall (west edge x=13.35).
  ["server-in", 12.6, -7.5, ["cor-server"]],
  // ---- Central aisle (x=0): corridor → lobby, between the desk columns ----
  ["aisle-n", 0, -1.5, ["cor-recovery", "cor-pantry", "aisle-1"]],
  ["aisle-1", 0, 0.5, ["aisle-n", "aisle-2"]],
  ["aisle-2", 0, 2.5, ["aisle-1", "aisle-3", "proj-w"]],
  ["aisle-3", 0, 4.5, ["aisle-2", "lobby"]],
  // ---- Lobby (z 6..10): main entrance. lobby sits at z=8.6 so the
  // aisle leg clears the (relocated) reception counter's south edge.
  ["lobby", 0, 8.6, ["aisle-3", "entrance", "lobby-e"]],
  ["entrance", 0, 10, ["lobby"]],
  // lobby-e sits in the open east corner, clear of the sofa + coffee table.
  ["lobby-e", 8.8, 9.6, ["lobby"]],
  // ---- Project room: door on its east wall at (-6.5, 3.0) ----
  // proj-w sits at z=4.0 so the aisle-2 leg clears the south-row desk
  // chair at (-2,2.25) by 0.87 > 0.65.
  ["proj-w", -4.5, 4.0, ["aisle-2", "proj-door"]],
  ["proj-door", -6.5, 3.0, ["proj-w", "proj-in"]],
  ["proj-in", -11.5, 3.0, ["proj-door"]],
  // ---- Meeting room: door on its west wall at (9.5, 2.0) ----
  ["ws-e", 8.5, -2, ["cor-tpria", "meet-out"]],
  ["meet-out", 8.5, 2, ["ws-e", "meet-door"]],
  ["meet-door", 9.5, 2, ["meet-out", "meet-in"]],
  // meet-in jogs west + south (11.0,1.6) so it clears the meeting-table
  // box (west edge x=11.6) and the north-end chairs.
  ["meet-in", 11.0, 1.6, ["meet-door"]],
]);

export interface Point2D {
  x: number;
  z: number;
}

// ---------------------------------------------------------------------------
// Furniture obstacles (floor-plane footprints).
//
// Two shapes: circles for round/small items, axis-aligned boxes for
// rectangular furniture (a fat circle around a 3.8-wide counter used to
// swallow the lobby walkway — boxes fit the real footprint). Positions
// mirror the room components; `segmentBlocked` adds AGENT_RADIUS on top.
// ---------------------------------------------------------------------------

export type Obstacle =
  | { id: string; kind: "circle"; x: number; z: number; r: number }
  | { id: string; kind: "box"; x: number; z: number; hw: number; hd: number };

/** Agent body radius (world units) added to every obstacle. */
export const AGENT_RADIUS = 0.35;

const DESK_XS = [-4, -2, 2, 4];
const DESK_ZS = [-1.3, 1.3];

/** Desk chairs: south of north-row desks, north of south-row desks. */
const DESK_CHAIRS: Array<[number, number]> = DESK_XS.flatMap((x) => [
  [x, -0.35] as [number, number],
  [x, 2.25] as [number, number],
]);

const MEETING_CHAIRS: Array<[number, number]> = [
  [11.1, 2.6], [11.1, 3.8], [11.1, 5.0], [11.1, 6.2],
  [14.5, 2.6], [14.5, 3.8], [14.5, 5.0], [14.5, 6.2],
  [12.8, 1.2], [12.8, 7.6],
];

const PANTRY_CHAIRS: Array<[number, number]> = [
  [4.2, -8.5], [4.2, -6.5], [3.2, -7.5], [5.2, -7.5],
];

const PLANTS: Array<[number, number]> = [
  // West plant flanks the counter's east end: the 0.475 gap between the
  // counter's west edge and the lobby wall cannot fit a pot.
  [-1.6, 7.4], [2.4, 7.4], [8.6, 6.5],
  [-15.3, -11.0], [-7.3, 8.8], [-15.2, 2.0],
];

export const OBSTACLES: Obstacle[] = [
  // 8 workspace desks (1.7 × 0.85) — Workspace.tsx / floorPlan WORKSTATIONS
  ...DESK_XS.flatMap((x) =>
    DESK_ZS.map((z, zi): Obstacle => ({
      id: `desk-${x}-${zi}`,
      kind: "box",
      x,
      z,
      hw: 0.85,
      hd: 0.43,
    })),
  ),
  // Desk chairs (0.5 × 0.5)
  ...DESK_CHAIRS.map(([x, z], i): Obstacle => ({
    id: `desk-chair-${i}`,
    kind: "circle",
    x,
    z,
    r: 0.3,
  })),
  // Lobby: pink sofa (2.0 × 0.9) + round coffee table (r 0.55) — Reception.tsx
  { id: "lobby-sofa", kind: "box", x: 6.5, z: 6.5, hw: 1.0, hd: 0.45 },
  { id: "lobby-coffee-table", kind: "circle", x: 6.5, z: 8.2, r: 0.55 },
  // Reception counter (3.8 × 1.1), relocated to the lobby's west side so
  // the entrance axis (x=0) stays clear — Reception.tsx
  { id: "reception-counter", kind: "box", x: -4, z: 7.4, hw: 1.9, hd: 0.55 },
  { id: "reception-chair", kind: "circle", x: -4, z: 6.7, r: 0.3 },
  // Meeting table (2.4 × 5.0) — MeetingRoom.tsx
  { id: "meeting-table", kind: "box", x: 12.8, z: 4.4, hw: 1.2, hd: 2.5 },
  ...MEETING_CHAIRS.map(([x, z], i): Obstacle => ({
    id: `meeting-chair-${i}`,
    kind: "circle",
    x,
    z,
    r: 0.3,
  })),
  // Pantry: counter (4.8 × 0.65) + round dining table (r 0.8) — Pantry.tsx
  { id: "pantry-counter", kind: "box", x: 4.2, z: -11.4, hw: 2.4, hd: 0.33 },
  { id: "pantry-table", kind: "circle", x: 4.2, z: -7.5, r: 0.8 },
  ...PANTRY_CHAIRS.map(([x, z], i): Obstacle => ({
    id: `pantry-chair-${i}`,
    kind: "circle",
    x,
    z,
    r: 0.3,
  })),
  // Server racks (0.9 × 0.8) — ServerRoom.tsx SERVER_RACKS
  { id: "server-rack-0", kind: "box", x: 13.8, z: -10, hw: 0.45, hd: 0.4 },
  { id: "server-rack-1", kind: "box", x: 13.8, z: -8.5, hw: 0.45, hd: 0.4 },
  { id: "server-rack-2", kind: "box", x: 13.8, z: -7, hw: 0.45, hd: 0.4 },
  // Recovery beds (1.05 × 2.1) — floorPlan RECOVERY_BEDS
  { id: "recovery-bed-0", kind: "box", x: -7.3, z: -10.8, hw: 0.53, hd: 1.05 },
  { id: "recovery-bed-1", kind: "box", x: -5.45, z: -10.8, hw: 0.53, hd: 1.05 },
  { id: "recovery-bed-2", kind: "box", x: -3.6, z: -10.8, hw: 0.53, hd: 1.05 },
  { id: "recovery-bed-3", kind: "box", x: -1.75, z: -10.8, hw: 0.53, hd: 1.05 },
  // Project room discussion table (1.8 × 0.9) — ProjectRoom.tsx
  { id: "project-table", kind: "box", x: -11.5, z: 5.5, hw: 0.9, hd: 0.45 },
  // Planter strips (0.5 × 5.6) — Workspace.tsx
  { id: "planter-w", kind: "box", x: -5.8, z: -0.4, hw: 0.25, hd: 2.8 },
  { id: "planter-e", kind: "box", x: 5.8, z: -0.4, hw: 0.25, hd: 2.8 },
  // Plants (pot r ~0.3)
  ...PLANTS.map(([x, z], i): Obstacle => ({
    id: `plant-${i}`,
    kind: "circle",
    x,
    z,
    r: 0.3,
  })),
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

/** True when point p lies inside obstacle o (strict, no agent radius). */
function pointInObstacle(p: Point2D, o: Obstacle): boolean {
  if (o.kind === "circle") return Math.hypot(p.x - o.x, p.z - o.z) < o.r;
  return (
    Math.abs(p.x - o.x) < o.hw && Math.abs(p.z - o.z) < o.hd
  );
}

/** Orientation test for segment intersection. */
function orient(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}

/** True when segments p1→p2 and p3→p4 intersect (including touching). */
function segmentsIntersect(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D,
): boolean {
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/**
 * True when segment a→b hits a box obstacle expanded by AGENT_RADIUS.
 * Box expansion is conservative at the corners (square instead of round),
 * which only ever detours an agent slightly wide — never through.
 */
function segmentHitsBox(
  a: Point2D,
  b: Point2D,
  o: Extract<Obstacle, { kind: "box" }>,
): boolean {
  const hw = o.hw + AGENT_RADIUS;
  const hd = o.hd + AGENT_RADIUS;
  const inside = (p: Point2D): boolean =>
    Math.abs(p.x - o.x) < hw && Math.abs(p.z - o.z) < hd;
  if (inside(a) || inside(b)) return true;
  const corners: Point2D[] = [
    { x: o.x - hw, z: o.z - hd },
    { x: o.x + hw, z: o.z - hd },
    { x: o.x + hw, z: o.z + hd },
    { x: o.x - hw, z: o.z + hd },
  ];
  for (let i = 0; i < 4; i++) {
    if (segmentsIntersect(a, b, corners[i], corners[(i + 1) % 4])) return true;
  }
  return false;
}

/**
 * True when the straight segment a→b passes within (obstacle + AGENT_RADIUS)
 * of any furniture obstacle. Obstacles containing either endpoint are
 * ignored so agents can start at / walk up to furniture (e.g. their desk
 * chair, which sits close to the desk box).
 */
export function segmentBlocked(a: Point2D, b: Point2D): boolean {
  for (const o of OBSTACLES) {
    if (pointInObstacle(a, o)) continue;
    if (pointInObstacle(b, o)) continue;
    if (o.kind === "circle") {
      if (distPointToSegment(o, a, b) < o.r + AGENT_RADIUS) return true;
    } else if (segmentHitsBox(a, b, o)) {
      return true;
    }
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
 *
 * Middle legs (waypoint→waypoint) are collision-repaired: if a leg is
 * blocked by furniture, the nearest waypoint that clears both sub-legs
 * is inserted as a detour (up to 8 insertions). First/last legs are
 * intentionally NOT repaired — the agent may legitimately start at or
 * arrive at furniture (desk chair, pantry chair, meeting seat).
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
  return repairMiddleLegs(from, out);
}

/**
 * Repair blocked waypoint→waypoint legs by inserting detour waypoints.
 * `path` is the findPath output (waypoints + exact destination); `from`
 * is the agent's current position. Only legs between two waypoints are
 * repaired — the first leg (agent may stand at furniture) and the last
 * leg (destination may be a chair/seat) are left alone.
 */
function repairMiddleLegs(from: Point2D, path: Point2D[]): Point2D[] {
  // Tag each point: true when it is a waypoint (all but the last point,
  // which is the exact destination — unless the destination coincides
  // with a waypoint, in which case treating it as a waypoint is fine).
  const isWaypoint = (p: Point2D): boolean =>
    Object.values(WAYPOINTS).some(
      (w) => Math.hypot(w.x - p.x, w.z - p.z) < 0.01,
    );
  const full: Point2D[] = [from, ...path];
  const waypointFlags: boolean[] = full.map((p, i) =>
    i === 0 ? false : i < full.length - 1 ? isWaypoint(p) : isWaypoint(p),
  );
  for (let insertions = 0; insertions < 8; insertions++) {
    let repaired = false;
    for (let i = 0; i < full.length - 1; i++) {
      // Only middle legs: both endpoints are waypoints, and the leg is
      // not the final leg into the destination.
      if (!waypointFlags[i] || !waypointFlags[i + 1]) continue;
      if (i + 1 === full.length - 1 && !isWaypoint(full[i + 1])) continue;
      const a = full[i];
      const b = full[i + 1];
      if (!segmentBlocked(a, b)) continue;
      // Find the detour waypoint minimizing extra travel that clears
      // both sub-legs.
      const candidates = Object.values(WAYPOINTS)
        .filter(
          (w) =>
            Math.hypot(w.x - a.x, w.z - a.z) > 0.01 &&
            Math.hypot(w.x - b.x, w.z - b.z) > 0.01,
        )
        .map((w) => ({
          w,
          extra:
            Math.hypot(w.x - a.x, w.z - a.z) +
            Math.hypot(w.x - b.x, w.z - b.z) -
            Math.hypot(b.x - a.x, b.z - a.z),
        }))
        .sort((c1, c2) => c1.extra - c2.extra);
      const detour = candidates.find(
        (c) =>
          !segmentBlocked(a, c.w) && !segmentBlocked(c.w, b),
      );
      if (!detour) continue;
      full.splice(i + 1, 0, { x: detour.w.x, z: detour.w.z });
      waypointFlags.splice(i + 1, 0, true);
      repaired = true;
      break;
    }
    if (!repaired) break;
  }
  return full.slice(1);
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
