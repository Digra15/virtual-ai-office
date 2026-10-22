import { describe, expect, it } from "vitest";
import {
  BLINK_DURATION,
  eyeOpenAmount,
  statusToAnimation,
  validateCharacterPreset,
  type CharacterPreset,
} from "./characterTypes";

const VALID: CharacterPreset = {
  agentId: "test",
  hairStyle: "bob",
  hairColor: "#1f2a44",
  eyeColor: "#2dd4bf",
  skinTone: "#f2c9a0",
  outfitStyle: "vest",
  outfitPrimary: "#eef2f6",
  outfitSecondary: "#2b3a55",
  accessory: "roundGlasses",
};

describe("statusToAnimation", () => {
  it("maps every agent status to an animation set", () => {
    expect(statusToAnimation("working")).toBe("typing");
    expect(statusToAnimation("thinking")).toBe("thinking");
    expect(statusToAnimation("idle")).toBe("idle");
    expect(statusToAnimation("waiting")).toBe("idle");
    expect(statusToAnimation("error")).toBe("idle");
    expect(statusToAnimation("offline")).toBe("idle");
  });
});

describe("eyeOpenAmount (blink)", () => {
  it("is fully open before and after a blink", () => {
    expect(eyeOpenAmount(5, 10)).toBe(1); // before
    expect(eyeOpenAmount(10 + BLINK_DURATION, 10)).toBe(1); // right after
    expect(eyeOpenAmount(11, 10)).toBe(1); // long after
  });

  it("closes then reopens across the blink", () => {
    // Start of blink: still open, fully shut at 40%, reopening after.
    expect(eyeOpenAmount(10, 10)).toBe(1);
    expect(eyeOpenAmount(10 + BLINK_DURATION * 0.4, 10)).toBeCloseTo(0, 5);
    const mid = eyeOpenAmount(10 + BLINK_DURATION * 0.7, 10);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe("validateCharacterPreset", () => {
  it("accepts a valid preset", () => {
    expect(validateCharacterPreset(VALID)).toEqual([]);
  });

  it("rejects non-objects", () => {
    expect(validateCharacterPreset(null).length).toBeGreaterThan(0);
    expect(validateCharacterPreset("nope").length).toBeGreaterThan(0);
  });

  it("rejects bad hex colors", () => {
    const problems = validateCharacterPreset({ ...VALID, hairColor: "red" });
    expect(problems.some((p) => p.includes("hairColor"))).toBe(true);
  });

  it("rejects unknown enum values", () => {
    const badHair = validateCharacterPreset({ ...VALID, hairStyle: "mohawk" });
    expect(badHair.some((p) => p.includes("hairStyle"))).toBe(true);
    const badOutfit = validateCharacterPreset({ ...VALID, outfitStyle: "tuxedo" });
    expect(badOutfit.some((p) => p.includes("outfitStyle"))).toBe(true);
    const badAcc = validateCharacterPreset({ ...VALID, accessory: "crown" });
    expect(badAcc.some((p) => p.includes("accessory"))).toBe(true);
  });

  it("rejects a missing agentId", () => {
    const { agentId: _drop, ...rest } = VALID;
    expect(
      validateCharacterPreset(rest).some((p) => p.includes("agentId")),
    ).toBe(true);
  });
});
