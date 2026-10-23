import { describe, expect, it } from "vitest";
import {
  getAllPresets,
  getCharacterPreset,
  prayerWearFor,
  PRESET_AGENT_IDS,
} from "./characterPresets";
import { PRAYER_WEARS, validateCharacterPreset } from "./characterTypes";

describe("character presets", () => {
  it("covers the 8 demo agents plus the reference character", () => {
    expect(PRESET_AGENT_IDS).toEqual([
      "nika",
      "research",
      "coding",
      "writing",
      "design",
      "data",
      "automation",
      "monitoring",
      "reference",
    ]);
  });

  it("gives every agent a unique visual identity", () => {
    const presets = getAllPresets();
    const signatures = presets.map(
      (p) => `${p.hairStyle}|${p.hairColor}|${p.outfitStyle}|${p.accessory}`,
    );
    expect(new Set(signatures).size).toBe(presets.length);
  });

  it("every hand-designed preset validates cleanly", () => {
    for (const p of getAllPresets()) {
      expect(validateCharacterPreset(p)).toEqual([]);
    }
  });

  it("resolves known ids to their designed preset", () => {
    expect(getCharacterPreset("nika").hairStyle).toBe("hime");
    expect(getCharacterPreset("coding").accessory).toBe("headphones");
    expect(getCharacterPreset("design").hairStyle).toBe("twintails");
    expect(getCharacterPreset("monitoring").eyeColor).toBe("#ef4444");
  });

  it("generates a deterministic, valid preset for unknown ids", () => {
    const a = getCharacterPreset("stress-01");
    const b = getCharacterPreset("stress-01");
    expect(a).toEqual(b);
    expect(a.agentId).toBe("stress-01");
    expect(validateCharacterPreset(a)).toEqual([]);
  });

  it("generates varied looks across unknown ids", () => {
    const styles = new Set(
      ["stress-01", "stress-02", "stress-03", "stress-04", "stress-05"].map(
        (id) => getCharacterPreset(id).hairStyle,
      ),
    );
    expect(styles.size).toBeGreaterThan(1);
  });
});

describe("prayerWear mapping (musola outfits, user correction 2026-10-22)", () => {
  it("maps female-coded characters to mukena, male-coded to sarungPeci", () => {
    expect(prayerWearFor(getCharacterPreset("nika"))).toBe("mukena");
    expect(prayerWearFor(getCharacterPreset("writing"))).toBe("mukena");
    expect(prayerWearFor(getCharacterPreset("design"))).toBe("mukena");
    expect(prayerWearFor(getCharacterPreset("research"))).toBe("sarungPeci");
    expect(prayerWearFor(getCharacterPreset("coding"))).toBe("sarungPeci");
    expect(prayerWearFor(getCharacterPreset("data"))).toBe("sarungPeci");
    expect(prayerWearFor(getCharacterPreset("automation"))).toBe(
      "sarungPeci",
    );
    expect(prayerWearFor(getCharacterPreset("monitoring"))).toBe("sarungPeci");
  });

  it("every hand-designed preset carries an explicit prayerWear", () => {
    for (const p of getAllPresets()) {
      expect(PRAYER_WEARS).toContain(p.prayerWear);
    }
  });

  it("an explicit prayerWear override wins over the default mapping", () => {
    const preset = { ...getCharacterPreset("nika"), prayerWear: "sarungPeci" as const };
    expect(prayerWearFor(preset)).toBe("sarungPeci");
  });

  it("unknown agents get a deterministic, valid prayerWear", () => {
    const a = getCharacterPreset("stress-07");
    expect(PRAYER_WEARS).toContain(a.prayerWear);
    expect(prayerWearFor(a)).toBe(a.prayerWear);
    expect(validateCharacterPreset(a)).toEqual([]);
  });
});
