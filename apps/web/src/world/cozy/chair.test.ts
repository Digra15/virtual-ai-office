import { describe, expect, it } from "vitest";
import { chairFacing } from "./CozyChair";

/**
 * Facing-convention contract (documented on CozyChairProps):
 * the backrest sits at local -Z, the chair faces local +Z, so the
 * world-space facing vector for a yaw is (sin θ, cos θ).
 */
describe("chairFacing — the chair facing convention", () => {
  it("rotationY=0 faces +Z (south)", () => {
    const [x, z] = chairFacing(0);
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(1);
  });

  it("rotationY=π faces -Z (north)", () => {
    const [x, z] = chairFacing(Math.PI);
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(-1);
  });

  it("rotationY=π/2 faces +X (east)", () => {
    const [x, z] = chairFacing(Math.PI / 2);
    expect(x).toBeCloseTo(1);
    expect(z).toBeCloseTo(0);
  });

  it("rotationY=-π/2 faces -X (west)", () => {
    const [x, z] = chairFacing(-Math.PI / 2);
    expect(x).toBeCloseTo(-1);
    expect(z).toBeCloseTo(0);
  });

  it("always returns a unit vector", () => {
    for (const a of [0.3, 1.1, 2.7, -0.8]) {
      const [x, z] = chairFacing(a);
      expect(Math.hypot(x, z)).toBeCloseTo(1);
    }
  });
});

