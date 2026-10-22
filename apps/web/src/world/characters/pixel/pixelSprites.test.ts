import { describe, expect, it, beforeEach } from "vitest";
import {
  CELEBRATE_SECONDS,
  FRAME_COUNTS,
  FRAME_FPS,
  PIXEL_ANIMATIONS,
  SPRITE_H,
  SPRITE_W,
  clearPixelSheetCache,
  getPixelSheet,
  renderSpriteFrame,
  resolvePixelAnimation,
  shade,
} from "./pixelSprites";
import {
  getAllPresets,
  getCharacterPreset,
} from "../characterPresets";
import { validateCharacterPreset } from "../characterTypes";
import type { CharacterPreset } from "../characterTypes";

function buffersDiffer(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true;
  return false;
}

const PRESETS = getAllPresets();

describe("sprite dimensions", () => {
  it("renders 28x36 RGBA buffers for all 8 presets", () => {
    expect(PRESETS).toHaveLength(8);
    for (const preset of PRESETS) {
      const buf = renderSpriteFrame(preset, "idle", 0);
      expect(buf.length).toBe(SPRITE_W * SPRITE_H * 4);
    }
  });

  it("every preset produces a non-empty sprite", () => {
    for (const preset of PRESETS) {
      const buf = renderSpriteFrame(preset, "idle", 0);
      let opaque = 0;
      for (let i = 3; i < buf.length; i += 4) if (buf[i] > 0) opaque++;
      // A chibi fills a healthy chunk of its 28x36 grid.
      expect(opaque).toBeGreaterThan(250);
    }
  });

  it("all 8 presets still validate against the CharacterPreset schema", () => {
    for (const preset of PRESETS) {
      expect(validateCharacterPreset(preset)).toEqual([]);
    }
  });
});

describe("palette mapping", () => {
  it("preset colors appear in the rendered sprite", () => {
    for (const preset of PRESETS) {
      const buf = renderSpriteFrame(preset, "idle", 0);
      const hex = (h: string): [number, number, number] => {
        const s = h.replace("#", "");
        return [
          parseInt(s.slice(0, 2), 16),
          parseInt(s.slice(2, 4), 16),
          parseInt(s.slice(4, 6), 16),
        ];
      };
      const has = (rgb: [number, number, number]) => {
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
      };
      expect(has(hex(preset.hairColor))).toBe(true);
      expect(has(hex(preset.skinTone))).toBe(true);
      expect(has(hex(preset.eyeColor))).toBe(true);
      expect(has(hex(preset.outfitPrimary))).toBe(true);    }
  });

  it("shade() darkens and lightens deterministically", () => {
    expect(shade("#808080", -0.5)).toBe("#404040");
    expect(shade("#808080", 0.5)).toBe("#c0c0c0");
    expect(shade("#000000", 1)).toBe("#000000");
  });
});

describe("frame sets", () => {
  it("declares the expected frame counts and fps", () => {
    expect(FRAME_COUNTS).toEqual({
      idle: 2,
      typing: 2,
      thinking: 2,
      walking: 4,
      meeting: 2,
      celebrate: 2,
    });
    for (const anim of PIXEL_ANIMATIONS) {
      expect(FRAME_FPS[anim]).toBeGreaterThan(0);
    }
  });

  it("idle frames differ (bob)", () => {
    const preset = getCharacterPreset("nika");
    expect(
      buffersDiffer(
        renderSpriteFrame(preset, "idle", 0),
        renderSpriteFrame(preset, "idle", 1),
      ),
    ).toBe(true);
  });

  it("walk frames cycle through distinct poses", () => {
    const preset = getCharacterPreset("coding");
    const frames = [0, 1, 2, 3].map((f) =>
      renderSpriteFrame(preset, "walking", f),
    );
    // Consecutive stride frames all differ from each other.
    for (let i = 0; i < frames.length; i++) {
      expect(
        buffersDiffer(frames[i], frames[(i + 1) % frames.length]),
      ).toBe(true);
    }
    // Stride poses differ from the neutral idle frame.
    const idle = renderSpriteFrame(preset, "idle", 0);
    expect(frames.some((f) => buffersDiffer(f, idle))).toBe(true);
  });

  it("typing frames alternate", () => {
    const preset = getCharacterPreset("research");
    expect(
      buffersDiffer(
        renderSpriteFrame(preset, "typing", 0),
        renderSpriteFrame(preset, "typing", 1),
      ),
    ).toBe(true);
  });

  it("thinking second frame adds the thought bubble + chin hand", () => {
    const preset = getCharacterPreset("data");
    const a = renderSpriteFrame(preset, "thinking", 0);
    const b = renderSpriteFrame(preset, "thinking", 1);
    expect(buffersDiffer(a, b)).toBe(true);
    // Bubble pixels are white and sit above the head (y < 9).
    let whiteAbove = 0;
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < SPRITE_W; x++) {
        const i = (y * SPRITE_W + x) * 4;
        if (
          b[i + 3] > 0 &&
          b[i] === 255 &&
          b[i + 1] === 255 &&
          b[i + 2] === 255
        ) {
          // Not white in frame 0 at the same spot.
          if (!(a[i] === 255 && a[i + 1] === 255 && a[i + 2] === 255)) {
            whiteAbove++;
          }
        }
      }
    }
    expect(whiteAbove).toBeGreaterThan(0);
  });

  it("meeting second frame raises an arm", () => {
    const preset = getCharacterPreset("design");
    expect(
      buffersDiffer(
        renderSpriteFrame(preset, "meeting", 0),
        renderSpriteFrame(preset, "meeting", 1),
      ),
    ).toBe(true);
  });

  it("celebrate first frame jumps higher than the landing frame", () => {
    const preset = getCharacterPreset("automation");
    const jump = renderSpriteFrame(preset, "celebrate", 0);
    const land = renderSpriteFrame(preset, "celebrate", 1);
    expect(buffersDiffer(jump, land)).toBe(true);
    // Lowest row of SHOE pixels (outline excluded): the jump frame's shoes
    // sit exactly 2px higher.
    const SHOE: [number, number, number] = [43, 43, 58];
    const lowestShoeRow = (b: Uint8ClampedArray): number => {
      let max = -1;
      for (let y = 0; y < SPRITE_H; y++) {
        for (let x = 0; x < SPRITE_W; x++) {
          const i = (y * SPRITE_W + x) * 4;
          if (
            b[i + 3] > 0 &&
            b[i] === SHOE[0] &&
            b[i + 1] === SHOE[1] &&
            b[i + 2] === SHOE[2]
          ) {
            max = y;
          }
        }
      }
      return max;
    };
    expect(lowestShoeRow(jump)).toBe(lowestShoeRow(land) - 2);
  });

  it("frame index wraps safely", () => {
    const preset = getCharacterPreset("monitoring");
    const a = renderSpriteFrame(preset, "walking", 4);
    const b = renderSpriteFrame(preset, "walking", 0);
    expect(buffersDiffer(a, b)).toBe(false);
  });
});

describe("blink", () => {
  it("blink variant differs from open eyes for every animation", () => {
    const preset = getCharacterPreset("writing");
    for (const anim of PIXEL_ANIMATIONS) {
      const open = renderSpriteFrame(preset, anim, 0, false);
      const shut = renderSpriteFrame(preset, anim, 0, true);
      expect(buffersDiffer(open, shut)).toBe(true);
    }
  });

  it("blink only redraws the eyes (silhouette outline unchanged)", () => {
    const preset = getCharacterPreset("nika");
    const open = renderSpriteFrame(preset, "idle", 0, false);
    const shut = renderSpriteFrame(preset, "idle", 0, true);
    // Count opaque pixels outside the eye band (y 12..16, x 8..19):
    // the silhouette must be pixel-identical there.
    const outside = (b: Uint8ClampedArray): number => {
      let sig = 0;
      for (let y = 0; y < SPRITE_H; y++) {
        for (let x = 0; x < SPRITE_W; x++) {
          const inEyeBand = y >= 12 && y <= 16 && x >= 8 && x <= 19;
          if (!inEyeBand && b[(y * SPRITE_W + x) * 4 + 3] > 0) sig++;
        }
      }
      return sig;
    };
    expect(outside(open)).toBe(outside(shut));
  });
});

describe("identity distinctness", () => {
  it("all 8 presets render differently from each other", () => {
    const bufs = PRESETS.map((p) => renderSpriteFrame(p, "idle", 0));
    for (let i = 0; i < bufs.length; i++) {
      for (let j = i + 1; j < bufs.length; j++) {
        expect(buffersDiffer(bufs[i], bufs[j])).toBe(true);
      }
    }
  });

  it("accessories leave a mark (glasses / hats differ from none)", () => {
    const base: CharacterPreset = {
      ...getCharacterPreset("research"),
      agentId: "test-acc",
      accessory: "none",
    };
    const plain = renderSpriteFrame(base, "idle", 0);
    const withGlasses = renderSpriteFrame(
      { ...base, accessory: "roundGlasses" },
      "idle",
      0,
    );
    expect(buffersDiffer(plain, withGlasses)).toBe(true);
  });
});

describe("sheet cache", () => {
  beforeEach(() => clearPixelSheetCache());

  it("returns the same sheet for the same preset", () => {
    const preset = getCharacterPreset("nika");
    expect(getPixelSheet(preset)).toBe(getPixelSheet(preset));
  });

  it("sheet get() wraps frames and matches direct renders", () => {
    const preset = getCharacterPreset("design");
    const sheet = getPixelSheet(preset);
    for (const anim of PIXEL_ANIMATIONS) {
      const count = FRAME_COUNTS[anim];
      for (let f = 0; f < count; f++) {
        for (const blink of [false, true]) {
          expect(
            buffersDiffer(
              sheet.get(anim, f, blink),
              renderSpriteFrame(preset, anim, f, blink),
            ),
          ).toBe(false);
        }
      }
    }
  });

  it("different presets get different sheets", () => {
    expect(getPixelSheet(getCharacterPreset("nika"))).not.toBe(
      getPixelSheet(getCharacterPreset("coding")),
    );
  });
});

describe("resolvePixelAnimation", () => {
  it("maps statuses like the old 3D rig", () => {
    expect(resolvePixelAnimation("working", null, false)).toBe("typing");
    expect(resolvePixelAnimation("thinking", null, false)).toBe("thinking");
    expect(resolvePixelAnimation("idle", null, false)).toBe("idle");
    expect(resolvePixelAnimation("waiting", null, false)).toBe("idle");
    expect(resolvePixelAnimation("error", null, false)).toBe("idle");
    expect(resolvePixelAnimation("offline", null, false)).toBe("idle");
  });

  it("locomotion override wins over status", () => {
    expect(resolvePixelAnimation("idle", "walking", false)).toBe("walking");
    expect(resolvePixelAnimation("working", "meeting", false)).toBe("meeting");
  });

  it("celebrating wins over everything", () => {
    expect(resolvePixelAnimation("idle", "walking", true)).toBe("celebrate");
    expect(resolvePixelAnimation("working", null, true)).toBe("celebrate");
  });

  it("celebrate duration constant is sane", () => {
    expect(CELEBRATE_SECONDS).toBeGreaterThan(0);
  });
});
