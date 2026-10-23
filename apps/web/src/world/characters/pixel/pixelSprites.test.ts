import { describe, expect, it, beforeEach } from "vitest";
import {
  CELEBRATE_SECONDS,
  FRAME_COUNTS,
  FRAME_FPS,
  PIXEL_ANIMATIONS,
  SPRITE_H,
  SPRITE_W,
  clearPixelSheetCache,
  getPixelFrame,
  pixelFrameCacheSize,
  renderSpriteFrame,
  resolvePixelAnimation,
  shade,
} from "./pixelSprites";
import {
  getAllPresets,
  getCharacterPreset,
} from "../characterPresets";
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

function hasColor(
  buf: Uint8ClampedArray,
  rgb: [number, number, number],
): boolean {
  for (let i = 0; i < buf.length; i += 4) {
    if (
      buf[i + 3] > 0 &&
      buf[i] === rgb[0] &&
      buf[i + 1] === rgb[1] &&
      buf[i + 2] === rgb[2]
    )
      return true;
  }
  return false;
}

function opaqueCount(buf: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 3; i < buf.length; i += 4) if (buf[i] > 0) n++;
  return n;
}

describe("sprite dimensions", () => {
  it("renders 48x48 RGBA buffers for all presets", () => {
    expect(SPRITE_W).toBe(48);
    expect(SPRITE_H).toBe(48);
    expect(PRESETS).toHaveLength(9);
    for (const preset of PRESETS) {
      const buf = renderSpriteFrame(preset, "front", "idle", 0);
      expect(buf.length).toBe(SPRITE_W * SPRITE_H * 4);
    }
  });

  it("every preset/animation/direction produces a non-empty sprite", () => {
    for (const preset of PRESETS) {
      for (const anim of PIXEL_ANIMATIONS) {
        for (const dir of DIRS) {
          for (let f = 0; f < FRAME_COUNTS[anim]; f++) {
            const buf = renderSpriteFrame(preset, dir, anim, f);
            // A chibi fills a healthy chunk of its 48x48 grid.
            expect(opaqueCount(buf)).toBeGreaterThan(400);
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

  it("covers 7 animations with richer frame counts", () => {
    expect(PIXEL_ANIMATIONS).toContain("praying");
    expect(FRAME_COUNTS.walking).toBe(8);
    expect(FRAME_COUNTS.idle).toBe(4);
    expect(FRAME_COUNTS.praying).toBe(4);
    expect(CELEBRATE_SECONDS).toBeGreaterThan(0);
    expect(Object.keys(FRAME_FPS)).toHaveLength(PIXEL_ANIMATIONS.length);
  });
});

describe("palette mapping", () => {
  it("preset hair color appears in front and back views", () => {
    for (const preset of PRESETS) {
      const hair = hex(preset.hairColor);
      expect(
        hasColor(renderSpriteFrame(preset, "front", "idle", 0), hair),
        `${preset.agentId} front hair`,
      ).toBe(true);
      expect(
        hasColor(renderSpriteFrame(preset, "back", "idle", 0), hair),
        `${preset.agentId} back hair`,
      ).toBe(true);
    }
  });

  it("eye color appears in front and side views (not back)", () => {
    for (const preset of PRESETS) {
      const eye = hex(preset.eyeColor);
      expect(
        hasColor(renderSpriteFrame(preset, "front", "idle", 0), eye),
        `${preset.agentId} front eyes`,
      ).toBe(true);
      expect(
        hasColor(renderSpriteFrame(preset, "side", "idle", 0), eye),
        `${preset.agentId} side eye`,
      ).toBe(true);
      expect(
        hasColor(renderSpriteFrame(preset, "back", "idle", 0), eye),
        `${preset.agentId} back has no eyes`,
      ).toBe(false);
    }
  });
});

describe("directional views", () => {
  const nika = getCharacterPreset("nika");

  it("front, side and back views are all distinct (idle + walking)", () => {
    for (const anim of ["idle", "walking"] as ChibiAnimation[]) {
      const front = renderSpriteFrame(nika, "front", anim, 0);
      const side = renderSpriteFrame(nika, "side", anim, 0);
      const back = renderSpriteFrame(nika, "back", anim, 0);
      expect(buffersDiffer(front, side)).toBe(true);
      expect(buffersDiffer(front, back)).toBe(true);
      expect(buffersDiffer(side, back)).toBe(true);
    }
  });

  it("walk frames differ across the 8-frame stride", () => {
    const frames = Array.from({ length: 8 }, (_, f) =>
      renderSpriteFrame(nika, "side", "walking", f),
    );
    let distinct = 0;
    for (let i = 0; i < frames.length; i++)
      for (let j = i + 1; j < frames.length; j++)
        if (buffersDiffer(frames[i], frames[j])) distinct++;
    // At least the step/together/bob variations must differ.
    expect(distinct).toBeGreaterThan(10);
  });

  it("blink frames differ from open-eye frames", () => {
    const open = renderSpriteFrame(nika, "front", "idle", 0, false);
    const blink = renderSpriteFrame(nika, "front", "idle", 0, true);
    expect(buffersDiffer(open, blink)).toBe(true);
  });

  it("frame index wraps around the animation length", () => {
    const a = renderSpriteFrame(nika, "front", "walking", 0);
    const b = renderSpriteFrame(nika, "front", "walking", 8);
    expect(buffersDiffer(a, b)).toBe(false);
  });
});

describe("prayer outfits", () => {
  const nika = getCharacterPreset("nika"); // mukena
  const data = getCharacterPreset("data"); // sarungPeci
  const VEIL: [number, number, number] = [248, 248, 252];
  const PECI: [number, number, number] = [24, 24, 30];

  it("mukena covers the hair with a white veil (front/side/back)", () => {
    for (const dir of DIRS) {
      const buf = renderSpriteFrame(nika, dir, "praying", 0, false, "mukena");
      expect(hasColor(buf, VEIL), `mukena ${dir} veil`).toBe(true);
      expect(
        hasColor(buf, hex(nika.hairColor)),
        `mukena ${dir} hides hair`,
      ).toBe(false);
    }
  });

  it("mukena still shows the face in front view", () => {
    const buf = renderSpriteFrame(nika, "front", "praying", 0, false, "mukena");
    expect(hasColor(buf, hex(nika.skinTone))).toBe(true);
  });

  it("sarungPeci adds a black peci cap and a sarong", () => {
    for (const dir of DIRS) {
      const buf = renderSpriteFrame(
        data,
        dir,
        "praying",
        0,
        false,
        "sarungPeci",
      );
      expect(hasColor(buf, PECI), `peci ${dir}`).toBe(true);
      expect(
        hasColor(buf, hex(data.outfitSecondary)),
        `sarong ${dir}`,
      ).toBe(true);
    }
  });

  it("prayer frames differ from the normal outfit", () => {
    const normal = renderSpriteFrame(nika, "front", "praying", 0);
    const prayer = renderSpriteFrame(nika, "front", "praying", 0, false, "mukena");
    expect(buffersDiffer(normal, prayer)).toBe(true);
  });

  it("prayer animation frames vary (standing → folded → bow → dua)", () => {
    const frames = [0, 1, 2, 3].map((f) =>
      renderSpriteFrame(nika, "front", "praying", f, false, "mukena"),
    );
    let distinct = 0;
    for (let i = 0; i < frames.length; i++)
      for (let j = i + 1; j < frames.length; j++)
        if (buffersDiffer(frames[i], frames[j])) distinct++;
    expect(distinct).toBeGreaterThan(0);
  });

  it("shade() still lightens and darkens", () => {
    expect(shade("#808080", 0.5)).not.toBe("#808080");
    expect(shade("#808080", -0.5)).not.toBe("#808080");
  });
});

describe("lazy frame cache", () => {
  beforeEach(() => clearPixelSheetCache());

  it("renders on first use and returns the cached buffer afterwards", () => {
    const preset = getCharacterPreset("nika");
    expect(pixelFrameCacheSize()).toBe(0);
    const a = getPixelFrame(preset, "side", "walking", 3);
    expect(pixelFrameCacheSize()).toBe(1);
    const b = getPixelFrame(preset, "side", "walking", 3);
    expect(b).toBe(a); // same reference — no re-render
    expect(pixelFrameCacheSize()).toBe(1);
  });

  it("keys the cache by direction, blink and prayer variant", () => {
    const preset = getCharacterPreset("nika");
    getPixelFrame(preset, "front", "idle", 0);
    getPixelFrame(preset, "side", "idle", 0);
    getPixelFrame(preset, "front", "idle", 0, true);
    getPixelFrame(preset, "front", "idle", 0, false, "mukena");
    expect(pixelFrameCacheSize()).toBe(4);
  });

  it("clearPixelSheetCache() empties the cache", () => {
    const preset = getCharacterPreset("nika");
    const a = getPixelFrame(preset, "front", "idle", 0);
    clearPixelSheetCache();
    expect(pixelFrameCacheSize()).toBe(0);
    const b = getPixelFrame(preset, "front", "idle", 0);
    expect(b).not.toBe(a);
    expect(buffersDiffer(a, b)).toBe(false); // same pixels, new buffer
  });

  it("does not pre-render views nobody asked for", () => {
    const preset = getCharacterPreset("coding");
    getPixelFrame(preset, "front", "idle", 0);
    // 1 frame cached — not the full 7 anims x 3 dirs x frames x blink set.
    expect(pixelFrameCacheSize()).toBe(1);
  });
});

describe("resolvePixelAnimation", () => {
  it("praying wins over celebrate, override and status", () => {
    expect(resolvePixelAnimation("working", "walking", true, true)).toBe(
      "praying",
    );
    expect(resolvePixelAnimation("meeting", "meeting", false, true)).toBe(
      "praying",
    );
  });

  it("keeps the previous priority order when not praying", () => {
    expect(resolvePixelAnimation("working", null, false)).toBe("typing");
    expect(resolvePixelAnimation("idle", null, true)).toBe("celebrate");
    expect(resolvePixelAnimation("idle", "walking", false)).toBe("walking");
    expect(resolvePixelAnimation("meeting", null, false)).toBe("meeting");
    expect(resolvePixelAnimation("working", "walking", true)).toBe("celebrate");
  });

  it("defaults praying to false (backward compatible)", () => {
    expect(resolvePixelAnimation("idle", null, false)).toBe("idle");
  });
});

describe("preset + schema integration", () => {
  it("every hand-designed preset renders in every view", () => {
    for (const preset of PRESETS) {
      for (const dir of DIRS) {
        const buf = renderSpriteFrame(preset, dir, "idle", 0);
        expect(opaqueCount(buf)).toBeGreaterThan(400);
      }
    }
  });

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
    const buf = renderSpriteFrame(custom, "side", "walking", 5);
    expect(opaqueCount(buf)).toBeGreaterThan(400);
  });
});
