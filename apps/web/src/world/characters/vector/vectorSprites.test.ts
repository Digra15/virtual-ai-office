import { describe, expect, it, beforeEach } from "vitest";
import {
  FRAME_COUNTS,
  VECTOR_ANIMATIONS,
  VECTOR_H,
  VECTOR_W,
  clearVectorSheetCache,
  getVectorFrame,
  renderVectorFrame,
  vectorFrameCacheSize,
} from "./vectorSprites";
import { getAllPresets, getCharacterPreset } from "../characterPresets";
import {
  validateCharacterPreset,
  type ChibiAnimation,
  type CharacterPreset,
  type SpriteDirection,
} from "../characterTypes";

function buffersDiffer(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true;
  return false;
}

const PRESETS = getAllPresets();
const DIRS: SpriteDirection[] = ["front", "side", "back"];

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/** True if any opaque pixel exactly matches the color. */
function hasColorExact(
  buf: Uint8ClampedArray,
  rgb: [number, number, number],
): boolean {
  for (let i = 0; i < buf.length; i += 4) {
    if (
      buf[i + 3] > 200 &&
      buf[i] === rgb[0] &&
      buf[i + 1] === rgb[1] &&
      buf[i + 2] === rgb[2]
    )
      return true;
  }
  return false;
}

/** True if any opaque pixel is within tolerance (for gradient fills). */
function hasColorNear(
  buf: Uint8ClampedArray,
  rgb: [number, number, number],
  tol = 24,
): boolean {
  for (let i = 0; i < buf.length; i += 4) {
    if (buf[i + 3] < 128) continue;
    if (
      Math.abs(buf[i] - rgb[0]) <= tol &&
      Math.abs(buf[i + 1] - rgb[1]) <= tol &&
      Math.abs(buf[i + 2] - rgb[2]) <= tol
    )
      return true;
  }
  return false;
}

function opaqueCount(buf: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 3; i < buf.length; i += 4) if (buf[i] > 12) n++;
  return n;
}

describe("vector sprite dimensions", () => {
  it("renders 192x192 RGBA buffers for all presets", () => {
    expect(VECTOR_W).toBe(192);
    expect(VECTOR_H).toBe(192);
    expect(PRESETS).toHaveLength(12);
    for (const preset of PRESETS) {
      const buf = renderVectorFrame(preset, "front", "idle", 0);
      expect(buf.length).toBe(VECTOR_W * VECTOR_H * 4);
    }
  });

  it("every preset/animation/direction produces a non-empty sprite", { timeout: 90000 }, () => {
    for (const preset of PRESETS) {
      for (const anim of VECTOR_ANIMATIONS) {
        for (const dir of DIRS) {
          for (let f = 0; f < FRAME_COUNTS[anim]; f++) {
            const buf = renderVectorFrame(preset, dir, anim, f);
            // A chibi fills a healthy chunk of its 192x192 grid.
            expect(opaqueCount(buf), `${preset.agentId} ${anim} ${dir} f${f}`).toBeGreaterThan(5000);
          }
        }
      }
    }
  });

  it("all 9 presets still validate against the CharacterPreset schema", () => {
    for (const preset of PRESETS) {
      expect(validateCharacterPreset(preset)).toEqual([]);
    }
  });

  it("covers 7 animations with the shared frame counts", () => {
    expect(VECTOR_ANIMATIONS).toContain("praying");
    expect(FRAME_COUNTS.walking).toBe(8);
    expect(FRAME_COUNTS.idle).toBe(4);
    expect(FRAME_COUNTS.praying).toBe(4);
  });
});

describe("vector palette mapping", () => {
  it("preset hair color appears in front and back views", () => {
    for (const preset of PRESETS) {
      const hair = hex(preset.hairColor);
      expect(
        hasColorNear(renderVectorFrame(preset, "front", "idle", 0), hair),
        `${preset.agentId} front hair`,
      ).toBe(true);
      expect(
        hasColorNear(renderVectorFrame(preset, "back", "idle", 0), hair),
        `${preset.agentId} back hair`,
      ).toBe(true);
    }
  });

  it("eye color appears in front and side views (not back)", () => {
    for (const preset of PRESETS) {
      const eye = hex(preset.eyeColor);
      // irises are solid exact fills; hair highlights are gradient blends
      expect(
        hasColorExact(renderVectorFrame(preset, "front", "idle", 0), eye),
        `${preset.agentId} front eyes`,
      ).toBe(true);
      expect(
        hasColorExact(renderVectorFrame(preset, "side", "idle", 0), eye),
        `${preset.agentId} side eye`,
      ).toBe(true);
      expect(
        hasColorExact(renderVectorFrame(preset, "back", "idle", 0), eye),
        `${preset.agentId} back has no eyes`,
      ).toBe(false);
    }
  });
});

describe("vector directional views", () => {
  const nika = getCharacterPreset("nika");

  it("front, side and back views are all distinct (idle + walking)", () => {
    for (const anim of ["idle", "walking"] as ChibiAnimation[]) {
      const front = renderVectorFrame(nika, "front", anim, 0);
      const side = renderVectorFrame(nika, "side", anim, 0);
      const back = renderVectorFrame(nika, "back", anim, 0);
      expect(buffersDiffer(front, side)).toBe(true);
      expect(buffersDiffer(front, back)).toBe(true);
      expect(buffersDiffer(side, back)).toBe(true);
    }
  });

  it("walk frames differ across the 8-frame stride", () => {
    const frames = Array.from({ length: 8 }, (_, f) =>
      renderVectorFrame(nika, "side", "walking", f),
    );
    let distinct = 0;
    for (let i = 0; i < frames.length; i++)
      for (let j = i + 1; j < frames.length; j++)
        if (buffersDiffer(frames[i], frames[j])) distinct++;
    expect(distinct).toBeGreaterThan(10);
  });

  it("blink frames differ from open-eye frames", () => {
    const open = renderVectorFrame(nika, "front", "idle", 0, false);
    const blink = renderVectorFrame(nika, "front", "idle", 0, true);
    expect(buffersDiffer(open, blink)).toBe(true);
  });

  it("frame index wraps around the animation length", () => {
    const a = renderVectorFrame(nika, "front", "walking", 0);
    const b = renderVectorFrame(nika, "front", "walking", 8);
    expect(buffersDiffer(a, b)).toBe(false);
  });
});

describe("vector prayer outfits", () => {
  const nika = getCharacterPreset("nika"); // mukena
  const data = getCharacterPreset("data"); // sarungPeci
  const VEIL: [number, number, number] = [247, 247, 251];
  const PECI: [number, number, number] = [23, 23, 29];

  it("mukena covers the hair with a white veil (front/side/back)", () => {
    for (const dir of DIRS) {
      const buf = renderVectorFrame(nika, dir, "praying", 0, false, "mukena");
      expect(hasColorNear(buf, VEIL, 30), `mukena ${dir} veil`).toBe(true);
      // tight tolerance: AA-blended iris edges can be near the hair color
      expect(
        hasColorNear(buf, hex(nika.hairColor), 10),
        `mukena ${dir} hides hair`,
      ).toBe(false);
    }
  });

  it("mukena still shows the face in front view", () => {
    const buf = renderVectorFrame(nika, "front", "praying", 0, false, "mukena");
    expect(hasColorNear(buf, hex(nika.skinTone), 30)).toBe(true);
  });

  it("sarungPeci adds a black peci cap and a sarong", () => {
    for (const dir of DIRS) {
      const buf = renderVectorFrame(data, dir, "praying", 0, false, "sarungPeci");
      expect(hasColorNear(buf, PECI, 30), `peci ${dir}`).toBe(true);
      expect(
        hasColorNear(buf, hex(data.outfitSecondary), 30),
        `sarong ${dir}`,
      ).toBe(true);
    }
  });

  it("prayer frames differ from the normal outfit", () => {
    const normal = renderVectorFrame(nika, "front", "praying", 0);
    const prayer = renderVectorFrame(nika, "front", "praying", 0, false, "mukena");
    expect(buffersDiffer(normal, prayer)).toBe(true);
  });
});

describe("vector lazy frame cache", () => {
  beforeEach(() => clearVectorSheetCache());

  it("renders on first use and returns the cached buffer afterwards", () => {
    const preset = getCharacterPreset("nika");
    expect(vectorFrameCacheSize()).toBe(0);
    const a = getVectorFrame(preset, "side", "walking", 3);
    expect(vectorFrameCacheSize()).toBe(1);
    const b = getVectorFrame(preset, "side", "walking", 3);
    expect(b).toBe(a);
    expect(vectorFrameCacheSize()).toBe(1);
  });

  it("keys the cache by direction, blink and prayer variant", () => {
    const preset = getCharacterPreset("nika");
    getVectorFrame(preset, "front", "idle", 0);
    getVectorFrame(preset, "side", "idle", 0);
    getVectorFrame(preset, "front", "idle", 0, true);
    getVectorFrame(preset, "front", "idle", 0, false, "mukena");
    expect(vectorFrameCacheSize()).toBe(4);
  });

  it("clearVectorSheetCache() empties the cache", () => {
    const preset = getCharacterPreset("nika");
    const a = getVectorFrame(preset, "front", "idle", 0);
    clearVectorSheetCache();
    expect(vectorFrameCacheSize()).toBe(0);
    const b = getVectorFrame(preset, "front", "idle", 0);
    expect(b).not.toBe(a);
    expect(buffersDiffer(a, b)).toBe(false);
  });
});

describe("vector preset + schema integration", () => {
  it("a fully custom preset object also renders", () => {
    const custom: CharacterPreset = {
      agentId: "custom-1",
      hairStyle: "spiky",
      hairColor: "#123456",
      eyeColor: "#abcdef",
      skinTone: "#fedcba",
      outfitStyle: "uniform",
      outfitPrimary: "#111111",
      outfitSecondary: "#222222",
      accessory: "cap",
      prayerWear: "sarungPeci",
    };
    expect(validateCharacterPreset(custom)).toEqual([]);
    const buf = renderVectorFrame(custom, "side", "walking", 5);
    expect(opaqueCount(buf)).toBeGreaterThan(5000);
  });
});
