import { describe, expect, it } from "vitest";
import { CUTES_MODEL } from "../characters/CutesAvatar";
import { MODEL_HEAD_TOP } from "../characters/hud";
import { CUTES_MODEL_SCALE } from "../characters/lying";
import { FACE_FRONT_Z } from "./accessories";
import { hairParams, HEAD_HALF_WIDTH, type HairKind } from "./hairStyles";

/**
 * QC for procedural hairstyles: wig shells must clear the face
 * (front at eye height behind the face plane) and cover the baked
 * hair at crown height — otherwise the original hair pokes through
 * or the face is buried. Citizen 2 is excluded from wig coverage:
 * its baked hair is 1.77 wide at mid-head, wider than any sane
 * shell, so it only gets add-on styles.
 */
describe("hair fit (probed)", () => {
  const urls = Object.values(CUTES_MODEL);
  const wigs: HairKind[] = ["afro", "bob", "long"];
  it("wig shells clear the face and cover the baked hair at the crown", () => {
    for (const kind of wigs) {
      for (const url of urls) {
        if (url === CUTES_MODEL.design) continue;
        const headTop = (MODEL_HEAD_TOP[url] ?? 0) / CUTES_MODEL_SCALE;
        const p = hairParams(kind, url, headTop);
        expect(p.shellFrontAtEye).toBeLessThan(p.faceFront);
        expect(p.faceFront - p.shellFrontAtEye).toBeGreaterThan(0.03);
        expect(p.shellHalfWidthAtCrown).toBeGreaterThan(
          HEAD_HALF_WIDTH[url] ?? 0.55,
        );
      }
    }
  });
  it("wig shells rise above the head top", () => {
    for (const kind of wigs) {
      for (const url of urls) {
        const headTop = (MODEL_HEAD_TOP[url] ?? 0) / CUTES_MODEL_SCALE;
        const p = hairParams(kind, url, headTop);
        const top = p.shellCenter[1] + p.shellRadius * (kind === "afro" ? 1 : 0.75);
        expect(top).toBeGreaterThan(headTop);
      }
    }
  });
  it("face tables cover every model", () => {
    for (const url of urls) {
      expect(FACE_FRONT_Z[url]).toBeDefined();
      expect(HEAD_HALF_WIDTH[url]).toBeDefined();
    }
  });
});
