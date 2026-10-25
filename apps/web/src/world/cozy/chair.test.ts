import { describe, expect, it } from "vitest";
import { chairFacing } from "./CozyChair";
import { GAMING_CHAIR_HEIGHT, GAMING_CHAIR_SEAT_Y } from "./GamingChair";

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

/**
 * GamingChair drop-in contract: it replaces CozyChair in the
 * workstation slots, so its seat height must match CozyChair's
 * (0.52) or the seated-agent fake breaks, and its tall bucket back
 * must actually be taller than CozyChair's (~1.33) to read as a
 * gaming chair.
 */
describe("GamingChair dimensions", () => {
  it("seat height matches CozyChair's seat", () => {
    expect(GAMING_CHAIR_SEAT_Y).toBe(0.52);
  });

  it("is a tall racing back, not a regular office chair", () => {
    expect(GAMING_CHAIR_HEIGHT).toBeGreaterThan(1.33);
    expect(GAMING_CHAIR_HEIGHT).toBeLessThan(1.6);
  });
});
