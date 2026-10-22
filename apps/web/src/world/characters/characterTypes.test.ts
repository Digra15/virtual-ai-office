import { describe, expect, it } from "vitest";
import {
  BLINK_DURATION,
  eyeOpenAmount,
  selectSpriteDirection,
  statusToAnimation,
  validateCharacterPreset,
  wrapAngle,
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
    expect(statusToAnimation("meeting")).toBe("meeting");
    // Recovering agents rest quietly: the calm "thinking" idle-set.
    expect(statusToAnimation("recovering")).toBe("thinking");
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

describe("validateCharacterPreset — prayerWear (additive, backward compatible)", () => {
  it("accepts a preset without prayerWear (old presets stay valid)", () => {
    expect(validateCharacterPreset(VALID)).toEqual([]);
  });

  it("accepts both prayerWear values", () => {
    expect(
      validateCharacterPreset({ ...VALID, prayerWear: "mukena" }),
    ).toEqual([]);
    expect(
      validateCharacterPreset({ ...VALID, prayerWear: "sarungPeci" }),
    ).toEqual([]);
  });

  it("rejects an unknown prayerWear value", () => {
    const problems = validateCharacterPreset({
      ...VALID,
      prayerWear: "abaya",
    });
    expect(problems.some((p) => p.includes("prayerWear"))).toBe(true);
  });
});

describe("wrapAngle", () => {
  it("wraps to (-PI, PI]", () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(Math.PI, 10); // −π excluded → +π
    expect(wrapAngle(Math.PI / 2 + 2 * Math.PI)).toBeCloseTo(Math.PI / 2, 10);
  });
});

describe("selectSpriteDirection", () => {
  it("picks front when the camera is in front of the character", () => {
    expect(selectSpriteDirection(0, 0)).toEqual({
      direction: "front",
      mirror: false,
    });
    expect(selectSpriteDirection(Math.PI, Math.PI)).toEqual({
      direction: "front",
      mirror: false,
    });
  });

  it("picks back when the camera is behind the character", () => {
    expect(selectSpriteDirection(0, Math.PI).direction).toBe("back");
    expect(selectSpriteDirection(0, -Math.PI).direction).toBe("back");
  });

  it("picks side with mirroring for perpendicular views", () => {
    // Camera on the character's local +x side → mirror.
    expect(selectSpriteDirection(0, Math.PI / 2)).toEqual({
      direction: "side",
      mirror: true,
    });
    // Camera on the local −x side → unmirrored.
    expect(selectSpriteDirection(0, -Math.PI / 2)).toEqual({
      direction: "side",
      mirror: false,
    });
  });

  it("respects the 45° / 135° boundaries", () => {
    expect(selectSpriteDirection(0, Math.PI / 4).direction).toBe("front");
    expect(selectSpriteDirection(0, Math.PI / 4 + 0.01).direction).toBe("side");
    expect(selectSpriteDirection(0, (-3 * Math.PI) / 4).direction).toBe("back");
    expect(selectSpriteDirection(0, (-3 * Math.PI) / 4 + 0.01).direction).toBe(
      "side",
    );
  });

  it("handles the desk scenario: seated worker seen from the side", () => {
    // ws-01 desk rotation 0 → visual facing PI (nose toward the monitor at
    // desk-local −z). Camera to the east (+x): shows the side profile.
    const view = selectSpriteDirection(Math.PI, Math.PI / 2);
    expect(view.direction).toBe("side");
    expect(view.mirror).toBe(false);
  });

  it("handles the desk scenario: camera behind the seated worker", () => {
    // Camera at +z behind the seated worker (visual facing PI) → back.
    expect(selectSpriteDirection(Math.PI, 0).direction).toBe("back");
  });

  it("handles walking: facing the movement direction", () => {
    // Walking toward +x (facing PI/2), camera ahead → front.
    expect(selectSpriteDirection(Math.PI / 2, Math.PI / 2).direction).toBe(
      "front",
    );
  });
});
