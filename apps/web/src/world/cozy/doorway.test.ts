import { describe, expect, it } from "vitest";
import {
  DOORWAY_OPEN_ANGLE_DEFAULT,
  DOORWAY_POST,
  doorwayVariantStyle,
  type DoorwayVariant,
} from "./Doorway";

const ALL_VARIANTS: DoorwayVariant[] = [
  "wood",
  "glass",
  "hospital",
  "security",
  "restroom_m",
  "restroom_f",
  "open_arch",
  "double_glass",
];

describe("doorwayVariantStyle", () => {
  it("constructs a style for all 8 variants without throwing", () => {
    for (const v of ALL_VARIANTS) {
      const s = doorwayVariantStyle(v);
      expect(s.frame).toBeTruthy();
      expect(s.leaf).toBeTruthy();
      expect(s.handle).toBeTruthy();
    }
  });

  it("wood: opaque brown leaf, no badge", () => {
    const s = doorwayVariantStyle("wood");
    expect(s.frame).toBe("#8b5a2b");
    expect(s.leafTransparent).toBe(false);
    expect(s.hasLeaf).toBe(true);
    expect(s.doubleLeaf).toBe(false);
    expect(s.badge).toBeNull();
  });

  it("glass: transparent panel", () => {
    const s = doorwayVariantStyle("glass");
    expect(s.leafTransparent).toBe(true);
    expect(s.leafOpacity).toBe(0.3);
    expect(s.hasLeaf).toBe(true);
  });

  it("hospital: pink frame, cross badge, porthole window", () => {
    const s = doorwayVariantStyle("hospital");
    expect(s.badge).toBe("cross");
    expect(s.window).toBe(true);
    expect(s.hasLeaf).toBe(true);
  });

  it("security: dark leaf with keypad badge", () => {
    const s = doorwayVariantStyle("security");
    expect(s.badge).toBe("keypad");
    expect(s.hasLeaf).toBe(true);
  });

  it("restroom_m / restroom_f: white leaf with blue / pink badge", () => {
    expect(doorwayVariantStyle("restroom_m").badge).toBe("toilet_m");
    expect(doorwayVariantStyle("restroom_f").badge).toBe("toilet_f");
  });

  it("open_arch: no leaf, arch trim instead", () => {
    const s = doorwayVariantStyle("open_arch");
    expect(s.hasLeaf).toBe(false);
    expect(s.arch).toBe(true);
  });

  it("double_glass: two transparent leaves", () => {
    const s = doorwayVariantStyle("double_glass");
    expect(s.hasLeaf).toBe(true);
    expect(s.doubleLeaf).toBe(true);
    expect(s.leafTransparent).toBe(true);
  });
});

describe("doorway builder constants", () => {
  it("keeps the user's dimensions and default swing", () => {
    expect(DOORWAY_POST).toBe(0.08);
    expect(DOORWAY_OPEN_ANGLE_DEFAULT).toBeCloseTo(0.95);
  });
});
