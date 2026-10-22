/**
 * Wander-target integrity: every idle-wander waypoint id must resolve to a
 * real waypoint, on the right floor, so agents never wander into the void.
 */
import { describe, expect, it } from "vitest";
import {
  WANDER_WAYPOINT_IDS,
  WANDER_WAYPOINT_IDS_2F,
  WAYPOINTS,
  mergedWaypoints,
} from "./navigation";

describe("wander waypoint ids", () => {
  it("every ground-floor wander id resolves in WAYPOINTS", () => {
    expect(WANDER_WAYPOINT_IDS.length).toBeGreaterThan(0);
    for (const id of WANDER_WAYPOINT_IDS) {
      const wp = WAYPOINTS[id];
      expect(wp, `wander id "${id}" missing from WAYPOINTS`).toBeDefined();
      expect(wp.floor ?? 0).toBe(0);
    }
  });

  it("every 2F wander id resolves in mergedWaypoints()", () => {
    const merged = mergedWaypoints();
    expect(WANDER_WAYPOINT_IDS_2F.length).toBeGreaterThan(0);
    for (const id of WANDER_WAYPOINT_IDS_2F) {
      const wp = merged[id];
      expect(wp, `wander id "${id}" missing from mergedWaypoints()`).toBeDefined();
    }
  });

  it("upper-floor u-* wander ids are upstairs; recep-in stays ground (by design)", () => {
    const merged = mergedWaypoints();
    for (const id of WANDER_WAYPOINT_IDS_2F) {
      const wp = merged[id];
      if (id.startsWith("u-")) {
        expect(wp.floor, `"${id}" should be upstairs`).toBe(1);
      }
    }
    // recep-in deliberately mixes ground-floor traffic into the 2F pool.
    expect(merged["recep-in"].floor ?? 0).toBe(0);
    expect([...WANDER_WAYPOINT_IDS_2F]).toContain("u-lounge");
    expect([...WANDER_WAYPOINT_IDS_2F]).toContain("u-hall");
    expect([...WANDER_WAYPOINT_IDS_2F]).toContain("u-land");
    expect([...WANDER_WAYPOINT_IDS_2F]).toContain("u-musola");
  });
});
