import { describe, expect, it } from "vitest";
import { CUTES_MODEL } from "../characters/CutesAvatar";
import { MODEL_HEAD_TOP } from "../characters/hud";
import { CUTES_MODEL_SCALE } from "../characters/lying";
import {
  ACCESSORIES,
  accessoryPlacement,
  accessoryScale,
  EYE_Y,
  FACE_FRONT_Z,
  type AccessoryId,
} from "./accessories";

/**
 * QC for the real-GLB NPC accessories: every placement is computed
 * from probed bounding boxes, and these tests pin the fit rules —
 * hats scaled to head width with rims at/below the crown, glasses
 * lenses landing on the face plane (not floating ahead or sunk),
 * backpack inside the torso band.
 */
describe("accessory placement (probed)", () => {
  const urls = Object.values(CUTES_MODEL);
  it("covers every CUTES model for eyes and face front", () => {
    for (const url of urls) {
      expect(EYE_Y[url]).toBeDefined();
      expect(FACE_FRONT_Z[url]).toBeDefined();
    }
  });
  it("hats scale to head width and sit with the rim at/below the crown", () => {
    const hats = (Object.keys(ACCESSORIES) as AccessoryId[]).filter(
      (id) => ACCESSORIES[id].kind === "hat",
    );
    expect(hats.length).toBeGreaterThanOrEqual(5);
    for (const id of hats) {
      const spec = ACCESSORIES[id];
      const scaledWidth = spec.rawWidth * accessoryScale(spec);
      expect(scaledWidth).toBeCloseTo(spec.targetWidth, 5);
      expect(spec.targetWidth).toBeGreaterThanOrEqual(0.86);
      for (const url of urls) {
        const headTop = (MODEL_HEAD_TOP[url] ?? 0) / CUTES_MODEL_SCALE;
        const p = accessoryPlacement(id, url, headTop);
        // Rim perches ON the crown: only 0.05 sunk, never buried in
        // the hair mass that reaches headTop.
        expect(p.position[1]).toBeCloseTo(headTop - 0.05, 5);
        // Crown of the hat rises above the head.
        expect(p.position[1] + spec.rawHeight * p.scale).toBeGreaterThan(headTop);
      }
    }
  });
  it("glasses lenses land on the face plane, vertically centered on the eyes", () => {
    const glasses = (Object.keys(ACCESSORIES) as AccessoryId[]).filter(
      (id) => ACCESSORIES[id].kind === "glasses",
    );
    expect(glasses.length).toBeGreaterThanOrEqual(5);
    for (const id of glasses) {
      const spec = ACCESSORIES[id];
      for (const url of urls) {
        const headTop = (MODEL_HEAD_TOP[url] ?? 0) / CUTES_MODEL_SCALE;
        const p = accessoryPlacement(id, url, headTop);
        // Lens plane = center z + lens offset = face front + 0.02.
        const lensZ = p.position[2] + (spec.lensOffset ?? 0) * p.scale;
        expect(lensZ).toBeCloseTo((FACE_FRONT_Z[url] ?? 0.62) + 0.02, 5);
        // Frame vertically centered on the probed eye height.
        const centerY = p.position[1] + (spec.rawHeight * p.scale) / 2;
        expect(centerY).toBeCloseTo(EYE_Y[url] ?? headTop - 0.3, 5);
      }
    }
  });
  it("backpack sits on the back inside the torso band", () => {
    for (const url of urls) {
      const headTop = (MODEL_HEAD_TOP[url] ?? 0) / CUTES_MODEL_SCALE;
      const p = accessoryPlacement("backpack", url, headTop);
      expect(p.position).toEqual([0, 0.72, -0.48]);
      expect(p.scale).toBeGreaterThan(1);
    }
  });
});
