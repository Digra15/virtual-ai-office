import { describe, expect, it } from "vitest";
import {
  getAllPresets,
  getCharacterPreset,
  PRESET_AGENT_IDS,
} from "./characterPresets";
import { validateCharacterPreset } from "./characterTypes";

describe("character presets", () => {
  it("covers exactly the 8 demo agents", () => {
    expect(PRESET_AGENT_IDS).toEqual([
      "nika",
      "research",
      "coding",
      "writing",
      "design",
      "data",
      "automation",
      "monitoring",
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
