import { describe, expect, it } from "vitest";
import {
  bfsPath,
  findPath,
  nearestWaypoint,
  nearestWaypointInZone,
  pathLength,
  segmentBlocked,
  WAYPOINTS,
  zoneOf,
} from "./navigation";
import { ROOMS, RECOVERY_BEDS, BUILDING } from "./building/floorPlan";

describe("waypoint graph", () => {
  it("every waypoint id referenced by neighbors exists", () => {
    for (const w of Object.values(WAYPOINTS)) {
      for (const nb of w.neighbors) {
        expect(WAYPOINTS[nb], `neighbor ${nb} of ${w.id}`).toBeDefined();
      }
    }
  });

  it("neighbor links are bidirectional", () => {
    for (const w of Object.values(WAYPOINTS)) {
      for (const nb of w.neighbors) {
        expect(WAYPOINTS[nb].neighbors, `${w.id} <-> ${nb}`).toContain(w.id);
      }
    }
  });

  it("the graph is fully connected", () => {
    const ids = Object.keys(WAYPOINTS);
    const start = ids[0];
    for (const id of ids) {
      expect(bfsPath(start, id).length, `route ${start} -> ${id}`).toBeGreaterThan(0);
    }
  });

  it("waypoints are single-floor (no floor/y fields)", () => {
    for (const w of Object.values(WAYPOINTS)) {
      expect("floor" in w, `${w.id} has a floor field`).toBe(false);
      expect("y" in w, `${w.id} has a y field`).toBe(false);
    }
  });

  it("bfs finds the short corridor route", () => {
    expect(bfsPath("cor-musola", "cor-server")).toEqual([
      "cor-musola",
      "cor-recovery",
      "cor-pantry",
      "cor-tpria",
      "cor-twanita",
      "cor-server",
    ]);
  });

  it("routes from a north-room door to the lobby via corridor + aisle", () => {
    const path = bfsPath("musola-in", "lobby");
    expect(path).toEqual([
      "musola-in",
      "cor-musola",
      "cor-recovery",
      "aisle-n",
      "aisle-1",
      "aisle-2",
      "aisle-3",
      "lobby",
    ]);
  });

  it("reaches the project room through its east-wall door", () => {
    const path = bfsPath("aisle-2", "proj-in");
    expect(path).toEqual(["aisle-2", "proj-w", "proj-door", "proj-in"]);
  });

  it("reaches the meeting room through its west-wall door", () => {
    const path = bfsPath("cor-tpria", "meet-in");
    expect(path).toEqual(["cor-tpria", "ws-e", "meet-out", "meet-door", "meet-in"]);
  });

  it("nearestWaypoint picks the closest", () => {
    expect(nearestWaypoint({ x: 0.2, z: 0.4 }).id).toBe("aisle-1");
    expect(nearestWaypoint({ x: -12.6, z: -7.4 }).id).toBe("musola-in");
  });

  it("findPath ends exactly on the destination", () => {
    const to = { x: 4, z: 1.3 }; // ws-08's desk
    const path = findPath({ x: -4, z: -1.3 }, to);
    expect(path.length).toBeGreaterThan(0);
    const end = path[path.length - 1];
    expect(end.x).toBeCloseTo(to.x);
    expect(end.z).toBeCloseTo(to.z);
  });

  it("findPath has no zero-length hops", () => {
    const path = findPath({ x: 0, z: 10 }, { x: 11.5, z: 2 });
    for (let i = 1; i < path.length; i++) {
      const d = Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
      expect(d).toBeGreaterThan(0.3);
    }
    expect(pathLength(path)).toBeGreaterThan(5);
  });

  it("every room is reachable from the main entrance (0,10)", () => {
    const entrance = { x: 0, z: 10 };
    for (const room of ROOMS) {
      const cx = (room.minX + room.maxX) / 2;
      const cz = (room.minZ + room.maxZ) / 2;
      const path = findPath(entrance, { x: cx, z: cz });
      expect(path.length, `entrance -> ${room.id}`).toBeGreaterThan(0);
      const end = path[path.length - 1];
      expect(end.x, `${room.id} end x`).toBeCloseTo(cx);
      expect(end.z, `${room.id} end z`).toBeCloseTo(cz);
    }
  });

  it("every room's door opening is reachable from the entrance", () => {
    const entrance = { x: 0, z: 10 };
    for (const room of ROOMS) {
      if (!room.door) continue; // workspace is open
      const path = findPath(entrance, { x: room.door.x, z: room.door.z });
      expect(path.length, `entrance -> ${room.id} door`).toBeGreaterThan(0);
    }
  });

  it("every recovery bed is reachable from a workspace desk", () => {
    for (const bed of RECOVERY_BEDS) {
      const path = findPath(
        { x: -4, z: -1.3 }, // ws-01
        { x: bed.position[0], z: bed.position[2] },
      );
      expect(path.length, `${bed.id} reachable`).toBeGreaterThan(0);
    }
  });

  it("waypoints stay inside the building footprint", () => {
    for (const w of Object.values(WAYPOINTS)) {
      expect(w.x, `${w.id} x`).toBeGreaterThanOrEqual(BUILDING.minX);
      expect(w.x, `${w.id} x`).toBeLessThanOrEqual(BUILDING.maxX);
      expect(w.z, `${w.id} z`).toBeGreaterThanOrEqual(BUILDING.minZ);
      expect(w.z, `${w.id} z`).toBeLessThanOrEqual(BUILDING.maxZ);
    }
  });
});

describe("collision-aware navigation", () => {
  it("segmentBlocked detects a segment cutting through a desk", () => {
    // Straight across desk row 1: passes through the desk at (-2,-1.3).
    expect(segmentBlocked({ x: -4, z: -1.3 }, { x: 0, z: -1.5 })).toBe(true);
    // Down the open central aisle: clear.
    expect(segmentBlocked({ x: 0, z: -1.5 }, { x: 0, z: 0.5 })).toBe(false);
  });

  it("segmentBlocked allows starting from / arriving at furniture", () => {
    // Destination IS the desk, approached from its open (chair) side.
    expect(segmentBlocked({ x: 4, z: 2.8 }, { x: 4, z: 1.3 })).toBe(false);
    // Start IS the desk: leaving it south is allowed.
    expect(segmentBlocked({ x: -4, z: -1.3 }, { x: -4, z: -3 })).toBe(false);
    // But walking to a desk THROUGH another desk is still blocked.
    expect(segmentBlocked({ x: 0, z: 0.5 }, { x: 4, z: 1.3 })).toBe(true);
  });

  it("segmentBlocked flags the lobby sofa and coffee table", () => {
    // Straight through the sofa at (6.5,6.5).
    expect(segmentBlocked({ x: 4, z: 6.5 }, { x: 9, z: 6.5 })).toBe(true);
    // Open lane west of the lobby furniture: clear.
    expect(segmentBlocked({ x: -6, z: 8 }, { x: -6, z: 4.5 })).toBe(false);
  });

  it("nearestWaypointInZone picks the door waypoint for room interiors", () => {
    expect(nearestWaypointInZone({ x: -12, z: -9 }).id).toBe("musola-in");
    expect(nearestWaypointInZone({ x: 4, z: -8 }).id).toBe("pantry-in");
    expect(nearestWaypointInZone({ x: -0.3, z: -10 }).id).toBe("recovery-in");
    expect(nearestWaypointInZone({ x: 13, z: -9 }).id).toBe("server-in");
    expect(nearestWaypointInZone({ x: 12, z: 4 }).id).toBe("meet-in");
    expect(nearestWaypointInZone({ x: -11, z: 5 }).id).toBe("proj-in");
  });

  it("musola -> pantry routes through door waypoints, no wall-crossing legs", () => {
    const from = { x: -12, z: -9 }; // musola interior
    const to = { x: 4, z: -8 }; // pantry interior
    const path = findPath(from, to);
    expect(path.length).toBeGreaterThan(0);

    // The route goes through the doors (door waypoints), not through walls.
    const ids = path.map((p) => {
      const w = Object.values(WAYPOINTS).find(
        (w) => Math.hypot(w.x - p.x, w.z - p.z) < 0.01,
      );
      return w?.id ?? null;
    });
    expect(ids).toContain("musola-in");
    expect(ids).toContain("cor-musola");
    expect(ids).toContain("cor-pantry");
    expect(ids).toContain("pantry-in");

    // First leg stays inside the musola (convex room: no wall crossing).
    expect(zoneOf(from)).toBe("musola");
    expect(zoneOf(path[0])).toBe("musola");
    // Last leg stays inside the pantry.
    expect(zoneOf(path[path.length - 2])).toBe("pantry");
    expect(zoneOf(to)).toBe("pantry");
    // Destination is exact.
    const end = path[path.length - 1];
    expect(end.x).toBeCloseTo(to.x);
    expect(end.z).toBeCloseTo(to.z);
  });

  it("desk -> recovery bed enters through the recovery door", () => {
    const to = { x: -3.6, z: -10.8 }; // bed-03
    const path = findPath({ x: -4, z: -1.3 }, to); // ws-01
    expect(path.length).toBeGreaterThan(0);
    const ids = path.map((p) => {
      const w = Object.values(WAYPOINTS).find(
        (w) => Math.hypot(w.x - p.x, w.z - p.z) < 0.01,
      );
      return w?.id ?? null;
    });
    // Enters the recovery room via its door waypoints, not through the wall.
    expect(ids).toContain("cor-recovery");
    expect(ids).toContain("recovery-in");
    // Ends exactly at the bed.
    const end = path[path.length - 1];
    expect(end.x).toBeCloseTo(to.x);
    expect(end.z).toBeCloseTo(to.z);
  });

});
