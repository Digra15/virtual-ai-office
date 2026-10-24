import { describe, expect, it } from "vitest";
import {
  BED_GEOMETRY,
  BED_SURFACES,
  LYING,
  LYING_MEASURED,
  isLying,
  lyingHeadDirection,
  lyingNoseDirection,
} from "./lying";

/** Bed centre z for all recovery beds (floorPlan.ts RECOVERY_BEDS). */
const BED_CENTER_Z = -10.8;
/** North wall of the recovery room. */
const NORTH_WALL_Z = -12;

describe("isLying (derived recovery pose)", () => {
  it("is true only for recovering + bed + not walking", () => {
    expect(
      isLying({ status: "recovering", hasBed: true, walking: false }),
    ).toBe(true);
  });

  it("is false while walking to the bed (still 'error')", () => {
    expect(isLying({ status: "error", hasBed: true, walking: true })).toBe(
      false,
    );
  });

  it("is false while walking back (healthy + moving)", () => {
    expect(isLying({ status: "idle", hasBed: true, walking: true })).toBe(
      false,
    );
  });

  it("is false for recovering without a bed (safe fallback: stand)", () => {
    expect(
      isLying({ status: "recovering", hasBed: false, walking: false }),
    ).toBe(false);
  });

  it("is false for every other status, even with a bed", () => {
    for (const status of [
      "idle",
      "working",
      "thinking",
      "waiting",
      "meeting",
      "error",
      "offline",
    ]) {
      expect(
        isLying({ status, hasBed: true, walking: false }),
        `should not lie for ${status}`,
      ).toBe(false);
    }
  });
});

describe("lying head direction (pitch + yaw proof)", () => {
  it("points north at LYING.facing", () => {
    expect(LYING.facing).toBe(0);
    const [x, y, z] = lyingHeadDirection(LYING.facing);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(-1); // world -z = north, toward the pillow
  });

  it("points south when yawed PI (sanity: yaw really steers the head)", () => {
    const [, , z] = lyingHeadDirection(Math.PI);
    expect(z).toBeCloseTo(1);
  });

  it("face points straight up regardless of yaw", () => {
    expect(lyingNoseDirection()).toEqual([0, 1, 0]);
  });
});

describe("lying placement on the bed (measured bbox, not guessed)", () => {
  it("back plane rests exactly on the duvet top", () => {
    // groupY + depthMin (negative) = back plane height.
    expect(LYING.groupY + LYING_MEASURED.depthMin).toBeCloseTo(
      BED_SURFACES.duvetTop,
      2,
    );
    // ...and the head presses slightly into the pillow, not through it.
    expect(LYING.groupY + LYING_MEASURED.depthMin).toBeLessThan(
      BED_SURFACES.pillowTop,
    );
  });

  it("body centres on the bed: head inside the north end, feet inside the south end", () => {
    const headTopZ = BED_CENTER_Z + (LYING.groupZ - LYING_MEASURED.height);
    const feetZ = BED_CENTER_Z + LYING.groupZ;
    expect(headTopZ).toBeGreaterThan(NORTH_WALL_Z); // never through the wall
    expect(headTopZ).toBeLessThan(BED_CENTER_Z); // head on the north half
    expect(feetZ).toBeLessThan(BED_CENTER_Z + BED_GEOMETRY.halfLength);
    expect(feetZ).toBeGreaterThan(BED_CENTER_Z);
  });

  it("head centre lands on the pillow", () => {
    // Head centre sits ~0.25 below the head top along the body axis.
    const headCentreZ = LYING.groupZ - (LYING_MEASURED.height - 0.25);
    expect(headCentreZ).toBeCloseTo(BED_GEOMETRY.pillowCenterZ, 1);
  });

  it("body fits the bed length, so no lying-only rescale is needed", () => {
    expect(LYING_MEASURED.height).toBeLessThan(BED_GEOMETRY.halfLength * 2);
  });

  it("width overhang stays clear of the neighbouring bed", () => {
    const overhang = LYING_MEASURED.widthHalf - BED_GEOMETRY.halfWidth;
    expect(overhang).toBeGreaterThan(0); // arms/hair flop over the edge
    expect(overhang).toBeLessThan(
      (BED_GEOMETRY.pitch - BED_GEOMETRY.halfWidth * 2) / 2,
    );
  });

  it("HUD floats above the flat body, name still above icon", () => {
    const bodyFrontY = LYING.groupY + LYING_MEASURED.depthMax;
    expect(LYING.hudIconY).toBeGreaterThan(bodyFrontY);
    expect(LYING.hudNameY).toBeGreaterThan(LYING.hudIconY);
    // ...but lower than the standing HUD (2.6 / 2.25).
    expect(LYING.hudNameY).toBeLessThan(2.6);
    expect(LYING.hudIconY).toBeLessThan(2.25);
  });
});
