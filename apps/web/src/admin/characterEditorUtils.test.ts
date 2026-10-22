import { describe, expect, it } from "vitest";
import type { AssetManifestEntry } from "@virtual-ai-office/shared";
import {
  modelOptions,
  presetFromRecord,
  supportsForModel,
  validateDraft,
} from "./characterEditorUtils";

const PNG_ASSET: AssetManifestEntry = {
  id: "pixel-mika-01",
  url: "https://cdn.example.com/pixel-mika-01.png",
  kind: "png",
  attribution: "Artist",
  license: "CC0-1.0",
  supports: { hairColor: true, eyeColor: false, outfit: false, accessories: true },
  animations: { idle: 2, walking: 4 },
  frameWidth: 28,
  frameHeight: 36,
  createdAt: "2026-10-22T00:00:00Z",
};

describe("character editor utils", () => {
  it("presetFromRecord fills missing fields with defaults and keeps agentId", () => {
    const p = presetFromRecord("nika", { hairColor: "#123456" });
    expect(p.agentId).toBe("nika");
    expect(p.hairColor).toBe("#123456");
    expect(p.eyeColor).toBe("#38bdf8");
    expect(p.accessory).toBe("none");
  });

  it("validateDraft returns no problems for a valid preset", () => {
    const problems = validateDraft("nika", presetFromRecord("nika", {}) as unknown as Record<string, unknown>);
    expect(problems).toEqual([]);
  });

  it("validateDraft surfaces validateCharacterPreset problems", () => {
    const problems = validateDraft("nika", {
      hairStyle: "mohawk",
      hairColor: "not-a-color",
      eyeColor: "#00ff00",
      skinTone: "#ffd9b8",
      outfitStyle: "sweater",
      outfitPrimary: "#3a4356",
      outfitSecondary: "#232a3a",
      accessory: "none",
    });
    expect(problems.some((p) => p.includes("hairStyle"))).toBe(true);
    expect(problems.some((p) => p.includes("hairColor"))).toBe(true);
    expect(problems.length).toBeGreaterThanOrEqual(2);
  });

  it("validateDraft flags an empty agentId", () => {
    const problems = validateDraft("", presetFromRecord("", {}) as unknown as Record<string, unknown>);
    expect(problems.some((p) => p.includes("agentId"))).toBe(true);
  });

  it("supportsForModel returns all-true for the built-in pixel sprite", () => {
    expect(supportsForModel("procedural-pixel", [PNG_ASSET])).toEqual({
      hairColor: true,
      eyeColor: true,
      outfit: true,
      accessories: true,
    });
  });

  it("supportsForModel gates options by the PNG manifest flags", () => {
    expect(supportsForModel("pixel-mika-01", [PNG_ASSET])).toEqual({
      hairColor: true,
      eyeColor: false,
      outfit: false,
      accessories: true,
    });
  });

  it("supportsForModel returns all-false for an unknown model id", () => {
    expect(supportsForModel("nope", [PNG_ASSET])).toEqual({
      hairColor: false,
      eyeColor: false,
      outfit: false,
      accessories: false,
    });
  });

  it("modelOptions lists the built-in pixel sprite first, then manifest assets", () => {
    const opts = modelOptions([PNG_ASSET]);
    expect(opts[0].id).toBe("procedural-pixel");
    expect(opts[1].id).toBe("pixel-mika-01");
    expect(opts[1].label).toContain("CC0-1.0");
  });
});
