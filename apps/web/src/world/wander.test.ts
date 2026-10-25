/**
 * Wander-target integrity: every idle-wander spot must be a walkable
 * point on the single floor (inside the building, inside the expected
 * room), so agents never wander into the void.
 */
import { describe, expect, it } from "vitest";
import { WANDER_SPOTS } from "../features/wander/WanderDirector";
import { BUILDING, roomAt } from "./building/floorPlan";

describe("wander spots", () => {
  it("has the expected 12 spots", () => {
    expect(WANDER_SPOTS).toHaveLength(12);
    const labels = WANDER_SPOTS.map((s) => s.label);
    expect(labels.filter((l) => l === "musola")).toHaveLength(3);
    // Pantry is 4 dining chairs now (one agent per chair), not the
    // old single table-center spot agents used to stand inside.
    expect(labels.filter((l) => l === "pantry")).toHaveLength(4);
    // Toilet trips: one standing spot per toilet room.
    expect(labels.filter((l) => l === "toilet")).toHaveLength(2);
    expect(labels).toContain("lobby sofa");
    expect(labels).toContain("corridor");
    expect(labels).toContain("aisle");
  });

  it("every spot is inside the building footprint", () => {
    for (const s of WANDER_SPOTS) {
      expect(s.x, `${s.label} x`).toBeGreaterThanOrEqual(BUILDING.minX);
      expect(s.x, `${s.label} x`).toBeLessThanOrEqual(BUILDING.maxX);
      expect(s.z, `${s.label} z`).toBeGreaterThanOrEqual(BUILDING.minZ);
      expect(s.z, `${s.label} z`).toBeLessThanOrEqual(BUILDING.maxZ);
    }
  });

  it("spots sit in their expected rooms", () => {
    for (const s of WANDER_SPOTS) {
      const roomId = roomAt(s.x, s.z, 0)?.id;
      if (s.label === "musola") {
        expect(roomId, `musola spot at (${s.x}, ${s.z})`).toBe("musola");
      } else if (s.label === "pantry") {
        expect(roomId, `pantry spot`).toBe("pantry");
      } else if (s.label === "toilet") {
        expect(roomId, `toilet spot at (${s.x}, ${s.z})`).toMatch(
          /^toilet_(pria|wanita)$/,
        );
      } else if (s.label === "lobby sofa") {
        expect(roomId, `sofa spot`).toBe("lobby");
      } else {
        // corridor / aisle spots must not be inside a walled room.
        expect(
          roomId === "workspace" || roomId === null,
          `spot (${s.x}, ${s.z}) should be walkable`,
        ).toBe(true);
      }
    }
  });

  it("musola spots are exactly the prayer rows from the plan", () => {
    const musola = WANDER_SPOTS.filter((s) => s.label === "musola");
    expect(musola.map((s) => [s.x, s.z])).toEqual([
      [-13.2, -9.5],
      [-11.6, -9.5],
      [-10.0, -9.5],
    ]);
  });
});
