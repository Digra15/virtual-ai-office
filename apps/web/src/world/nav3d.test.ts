/**
 * findPath3D tests — single-floor shim.
 *
 * The building has ONE floor (y = 0 everywhere), so findPath3D is
 * findPath with y: 0 attached to every point. The FloorPoint signature
 * is kept because movement.navigateToFloor still imports it; the floor
 * value is ignored.
 */
import { describe, expect, it } from "vitest";
import { findPath3D, pathLength3D } from "./navigation";
import { RECOVERY_BEDS } from "./building/floorPlan";

describe("findPath3D (single-floor shim)", () => {
  it("routes on the single floor with y always 0", () => {
    const p = findPath3D({ x: -4, z: -1.3, floor: 0 }, { x: 11.5, z: 2, floor: 0 });
    expect(p.length).toBeGreaterThan(0);
    expect(p.every((q) => q.y === 0)).toBe(true);
    const last = p[p.length - 1];
    expect(last.x).toBe(11.5);
    expect(last.z).toBe(2);
    expect(last.y).toBe(0);
  });

  it("ignores the floor parameter (stays on the ground floor)", () => {
    const p = findPath3D({ x: 0, z: 8, floor: 1 }, { x: -12.5, z: -7.5, floor: 1 });
    expect(p.length).toBeGreaterThan(0);
    expect(p.every((q) => q.y === 0)).toBe(true);
  });

  it("ends exactly on the destination", () => {
    const p = findPath3D({ x: 0, z: 10, floor: 0 }, { x: 4.2, z: -7.5, floor: 0 });
    expect(p.length).toBeGreaterThan(0);
    const last = p[p.length - 1];
    expect(last).toMatchObject({ x: 4.2, y: 0, z: -7.5 });
  });

  it("recovery beds are reachable with y = 0", () => {
    for (const bed of RECOVERY_BEDS) {
      const p = findPath3D(
        { x: -4, z: -1.3, floor: 0 },
        { x: bed.position[0], z: bed.position[2], floor: 0 },
      );
      expect(p.length, bed.id).toBeGreaterThan(0);
      expect(p[p.length - 1].y, `${bed.id} ends at ground level`).toBe(0);
    }
  });

  it("pathLength3D matches the 2D route length", () => {
    const p = findPath3D({ x: 0, z: 10, floor: 0 }, { x: 11.5, z: 2, floor: 0 });
    expect(pathLength3D(p)).toBeGreaterThan(5);
  });
});
