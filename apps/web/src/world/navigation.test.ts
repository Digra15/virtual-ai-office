import { describe, expect, it } from "vitest";
import {
  bfsPath,
  findPath,
  nearestWaypoint,
  pathLength,
  WANDER_WAYPOINT_IDS,
  WAYPOINTS,
  mergedWaypoints,
} from "./navigation";

describe("waypoint graph", () => {
  it("every waypoint id referenced by neighbors exists (merged graph)", () => {
    const all = mergedWaypoints();
    for (const w of Object.values(all)) {
      for (const nb of w.neighbors) {
        expect(all[nb], `neighbor ${nb} of ${w.id}`).toBeDefined();
      }
    }
  });

  it("neighbor links are bidirectional (merged graph)", () => {
    const all = mergedWaypoints();
    for (const w of Object.values(all)) {
      for (const nb of w.neighbors) {
        expect(all[nb].neighbors, `${w.id} <-> ${nb}`).toContain(w.id);
      }
    }
  });

  it("the ground graph is fully connected", () => {
    const ids = Object.keys(WAYPOINTS);
    const start = ids[0];
    for (const id of ids) {
      expect(bfsPath(start, id).length, `route ${start} -> ${id}`).toBeGreaterThan(0);
    }
  });

  it("bfs finds the short direct route", () => {
    expect(bfsPath("aisle-w", "aisle-e")).toEqual([
      "aisle-w",
      "aisle-wc",
      "aisle-c",
      "aisle-ec",
      "aisle-e",
    ]);
  });

  it("routes around the desk block (no straight cut through desks)", () => {
    // From a north-corridor point to an aisle point: must go via west/east
    // corridor, never straight through the desk rows at z=-1.5.
    const path = bfsPath("north-c", "aisle-c");
    expect(path.length).toBeGreaterThan(2);
    // Every hop stays on corridors/aisle (all waypoints are placed in open space).
    for (const id of path) expect(WAYPOINTS[id]).toBeDefined();
  });

  it("nearestWaypoint picks the closest", () => {
    expect(nearestWaypoint({ x: 0.2, z: 1.1 }).id).toBe("aisle-c");
    expect(nearestWaypoint({ x: -14, z: -9 }).id).toBe("meet-in");
  });

  it("findPath ends exactly on the destination", () => {
    const to = { x: 2.5, z: -1.5 }; // a desk
    const path = findPath({ x: -7.5, z: -1.5 }, to);
    expect(path.length).toBeGreaterThan(0);
    const end = path[path.length - 1];
    expect(end.x).toBeCloseTo(to.x);
    expect(end.z).toBeCloseTo(to.z);
  });

  it("findPath has no zero-length hops", () => {
    const path = findPath({ x: 0, z: 1 }, { x: 8, z: 10.5 });
    for (let i = 1; i < path.length; i++) {
      const d = Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
      expect(d).toBeGreaterThan(0.3);
    }
    expect(pathLength(path)).toBeGreaterThan(5);
  });

  it("wander spots are all real waypoints", () => {
    for (const id of WANDER_WAYPOINT_IDS) {
      expect(WAYPOINTS[id], id).toBeDefined();
    }
  });
});
