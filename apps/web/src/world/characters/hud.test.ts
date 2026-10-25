import { describe, expect, it } from "vitest";
import {
  CAPTION_CLEARANCE,
  MODEL_HEAD_TOP,
  NAME_GAP,
  hudHeights,
} from "./hud";
import { CUTES_MODEL } from "./CutesAvatar";

describe("per-model HUD heights", () => {
  it("covers every CUTES model", () => {
    for (const url of Object.values(CUTES_MODEL)) {
      expect(MODEL_HEAD_TOP[url], url).toBeDefined();
    }
  });

  it("clears the tallest hair (Citizen 2, Design) with margin", () => {
    const tall = MODEL_HEAD_TOP["/models/cutes/Citizen 2.glb"];
    expect(tall).toBe(2.41);
    const { nameY, captionY } = hudHeights(
      "/models/cutes/Citizen 2.glb",
      0,
    );
    // Caption floats a full clearance above the hair, name above that.
    expect(captionY - tall).toBeCloseTo(CAPTION_CLEARANCE);
    expect(nameY - captionY).toBeCloseTo(NAME_GAP);
    // Seated (model group +0.18) rises with the head, never into it.
    const seated = hudHeights("/models/cutes/Citizen 2.glb", 0.18);
    expect(seated.captionY - (tall + 0.18)).toBeCloseTo(CAPTION_CLEARANCE);
  });

  it("falls back to the tallest model for an unknown URL", () => {
    const { captionY } = hudHeights("/models/cutes/Unknown.glb", 0);
    expect(captionY).toBe(2.41 + CAPTION_CLEARANCE);
  });

  it("keeps the old name-above-caption order for a typical model", () => {
    const { nameY, captionY } = hudHeights(
      "/models/cutes/Generic Female.glb",
      0,
    );
    expect(nameY).toBeGreaterThan(captionY);
    expect(captionY).toBeCloseTo(1.93 + CAPTION_CLEARANCE);
  });
});
