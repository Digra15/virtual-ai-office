/**
 * Procedural 2D pixel-art sprite renderer for agent characters.
 *
 * The office scene renders agents as 2D pixel-art billboard sprites
 * (2.5D "Paper Mario" style) instead of rigid 3D figures: every animation
 * is a hand-drawn frame set, which reads as far less stiff than transform
 * animation on a low-poly rig.
 *
 * 2.5D DIRECTIONAL SPRITES (2026-10-22): the old full-billboard always
 * faced the camera, so a desk worker stared at the viewer even when seen
 * from the side. Now every animation is drawn in three views — front,
 * back, and side (facing sprite-local +x, mirrored for the other side) —
 * and the renderer picks the view from the angle between the agent's
 * facing vector and the camera direction (see `selectSpriteDirection` in
 * characterTypes.ts). Viewed from the side, a desk worker now shows their
 * side profile facing the computer.
 *
 * MUSOLA PRAYER OUTFITS (2026-10-22, user correction): when an agent is
 * in the musola (room id "musola") it plays the "praying" animation in a
 * prayer outfit — white mukena (veil covering head and body) for
 * female-coded characters, sarong + black peci cap for male-coded ones
 * (`prayerWear` on the preset, resolved via `prayerWearFor()`).
 *
 * Design notes:
 * - Pure pixel buffers (Uint8ClampedArray) — no DOM, no Three.js here, so
 *   this module is fully unit-testable. Canvas/texture conversion lives in
 *   the components that need it (PixelAvatar, 2D previews).
 * - Grid is 48x48 px (upgraded from 28x36 for the reference character
 *   sheet's richness: hair shading bands, outfit details, accessories).
 *   Sprites are rendered with THREE.NearestFilter, so the individual
 *   pixels stay visible ("agak pixel pixel").
 * - Everything is palette-driven from CharacterPreset: hair style/color,
 *   skin tone, eye color, outfit colors and accessory all flow through, so
 *   admin customization keeps working unchanged.
 * - Frames are rendered LAZILY per (preset, direction, animation, frame,
 *   blink, prayer) and cached; the scene never redraws pixels per frame
 *   (60fps-friendly) and never pays for views/animations it doesn't show.
 */
import type {
  AccessoryKind,
  CharacterPreset,
  ChibiAnimation,
  HairStyle,
  OutfitStyle,
  PrayerWear,
  SpriteDirection,
} from "../characterTypes";
import { statusToAnimation } from "../characterTypes";
import type { AgentStatus } from "@virtual-ai-office/shared";

/** Sprite grid dimensions (pixels). Upgraded 28x36 → 48x48. */
export const SPRITE_W = 48;
export const SPRITE_H = 48;

/** All animations the sprite system can play. */
export const PIXEL_ANIMATIONS: ChibiAnimation[] = [
  "idle",
  "typing",
  "thinking",
  "walking",
  "meeting",
  "celebrate",
  "praying",
];

/** Frame count per animation. Walk gets 8 frames so the stride cycles. */
export const FRAME_COUNTS: Record<ChibiAnimation, number> = {
  idle: 4,
  typing: 4,
  thinking: 4,
  walking: 8,
  meeting: 2,
  celebrate: 2,
  praying: 4,
};

/** Playback speed per animation (frames per second). */
export const FRAME_FPS: Record<ChibiAnimation, number> = {
  idle: 2,
  typing: 6,
  thinking: 2,
  walking: 8,
  meeting: 3,
  celebrate: 6,
  praying: 1.5,
};

/** Seconds the celebrate animation plays after a task completes. */
export const CELEBRATE_SECONDS = 2.5;

/** How long the eyes stay shut during a blink, in seconds. */
export const PIXEL_BLINK_DURATION = 0.14;

/** Prayer outfit variant for one rendered frame (null = normal outfit). */
export type PrayerVariant = PrayerWear | null;

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/**
 * Lighten (amt > 0) or darken (amt < 0) a hex color by a fraction.
 * Exported for tests.
 */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = 1 + amt;
  return rgbToHex([r * f, g * f, b * f]);
}

// ---------------------------------------------------------------------------
// Pixel buffer
// ---------------------------------------------------------------------------

/** Tiny pixel canvas: RGBA buffer with clipped rect fills. */
export class Pix {
  readonly w: number;
  readonly h: number;
  readonly buf: Uint8ClampedArray<ArrayBuffer>;
  /** Global vertical offset applied to every draw (bob / jump). */
  oy = 0;

  constructor(w: number = SPRITE_W, h: number = SPRITE_H) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8ClampedArray(w * h * 4);
  }

  set(x: number, y: number, rgb: RGB, a = 255): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.buf[i] = rgb[0];
    this.buf[i + 1] = rgb[1];
    this.buf[i + 2] = rgb[2];
    this.buf[i + 3] = a;
  }

  rect(x: number, y: number, w: number, h: number, rgb: RGB, a = 255): void {
    const yy = y + this.oy;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) this.set(x + i, yy + j, rgb, a);
  }

  /** Punch a transparent hole (rounded corners, etc). */
  clear(x: number, y: number, w: number, h: number): void {
    const yy = y + this.oy;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const px = x + i;
        const py = yy + j;
        if (px < 0 || py < 0 || px >= this.w || py >= this.h) continue;
        this.buf[(py * this.w + px) * 4 + 3] = 0;
      }
  }

  /** Count of non-transparent pixels (for tests). */
  get opaqueCount(): number {
    let n = 0;
    for (let i = 3; i < this.buf.length; i += 4) if (this.buf[i] > 0) n++;
    return n;
  }

  /** True if any pixel exactly matches the given RGB (for tests). */
  hasColor(rgb: RGB): boolean {
    for (let i = 0; i < this.buf.length; i += 4) {
      if (
        this.buf[i + 3] > 0 &&
        this.buf[i] === rgb[0] &&
        this.buf[i + 1] === rgb[1] &&
        this.buf[i + 2] === rgb[2]
      )
        return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

interface Palette {
  hair: RGB;
  hairDark: RGB;
  hairLight: RGB;
  skin: RGB;
  skinDark: RGB;
  eye: RGB;
  white: RGB;
  dark: RGB;
  blush: RGB;
  mouth: RGB;
  mouthOpen: RGB;
  out1: RGB;
  out1Dark: RGB;
  out1Light: RGB;
  out2: RGB;
  out2Dark: RGB;
  tie: RGB;
  shoe: RGB;
  outline: RGB;
  veil: RGB;
  veilDark: RGB;
  peci: RGB;
}

function makePalette(preset: CharacterPreset): Palette {
  return {
    hair: hexToRgb(preset.hairColor),
    hairDark: hexToRgb(shade(preset.hairColor, -0.32)),
    hairLight: hexToRgb(shade(preset.hairColor, 0.35)),
    skin: hexToRgb(preset.skinTone),
    skinDark: hexToRgb(shade(preset.skinTone, -0.18)),
    eye: hexToRgb(preset.eyeColor),
    white: [255, 255, 255],
    dark: [42, 42, 58],
    blush: [255, 158, 176],
    mouth: [163, 74, 74],
    mouthOpen: [120, 40, 48],
    out1: hexToRgb(preset.outfitPrimary),
    out1Dark: hexToRgb(shade(preset.outfitPrimary, -0.28)),
    out1Light: hexToRgb(shade(preset.outfitPrimary, 0.25)),
    out2: hexToRgb(preset.outfitSecondary),
    out2Dark: hexToRgb(shade(preset.outfitSecondary, -0.3)),
    tie: hexToRgb(preset.outfitSecondary),
    shoe: [43, 43, 58],
    outline: [35, 35, 52],
    veil: [248, 248, 252],
    veilDark: [214, 216, 228],
    peci: [24, 24, 30],
  };
}

// ---------------------------------------------------------------------------
// Frame specs
// ---------------------------------------------------------------------------

type LegPose = "neutral" | "stepL" | "stepR" | "together";
type ArmPose =
  | "down"
  | "swing"
  | "typing"
  | "chin"
  | "up"
  | "folded"
  | "dua";

interface FrameSpec {
  /** Whole-sprite vertical offset (bob / jump). */
  dy: number;
  legPose: LegPose;
  armL: ArmPose;
  armR: ArmPose;
  /** Typing: which hand is raised 1px this frame. */
  handUp: "L" | "R" | null;
  thought: boolean;
  mouthOpen: boolean;
}

function frameSpec(anim: ChibiAnimation, frame: number): FrameSpec {
  switch (anim) {
    case "idle": {
      // Gentle breathing: 4 frames, subtle 1px bob on frame 1.
      const dys = [0, -1, 0, 0];
      return {
        dy: dys[frame % 4],
        legPose: "neutral",
        armL: "down",
        armR: "down",
        handUp: null,
        thought: false,
        mouthOpen: false,
      };
    }
    case "typing":
      return {
        dy: 0,
        legPose: "neutral",
        armL: "typing",
        armR: "typing",
        handUp: frame % 2 === 0 ? "L" : "R",
        thought: false,
        mouthOpen: false,
      };
    case "thinking":
      return frame % 2 === 0
        ? {
            dy: 0,
            legPose: "neutral",
            armL: "down",
            armR: "down",
            handUp: null,
            thought: false,
            mouthOpen: false,
          }
        : {
            dy: 0,
            legPose: "neutral",
            armL: "down",
            armR: "chin",
            handUp: null,
            thought: true,
            mouthOpen: false,
          };
    case "walking": {
      // 8-frame stride: step → together → step → together, with bob.
      const poses: LegPose[] = [
        "stepL",
        "together",
        "stepR",
        "together",
        "stepL",
        "together",
        "stepR",
        "together",
      ];
      const f = frame % 8;
      return {
        dy: f % 2 === 1 ? -1 : 0,
        legPose: poses[f],
        armL: f === 0 || f === 4 ? "swing" : "down",
        armR: f === 2 || f === 6 ? "swing" : "down",
        handUp: null,
        thought: false,
        mouthOpen: false,
      };
    }
    case "meeting":
      return frame === 0
        ? {
            dy: 0,
            legPose: "neutral",
            armL: "down",
            armR: "down",
            handUp: null,
            thought: false,
            mouthOpen: false,
          }
        : {
            dy: 0,
            legPose: "neutral",
            armL: "down",
            armR: "up",
            handUp: null,
            thought: false,
            mouthOpen: true,
          };
    case "celebrate":
      return frame === 0
        ? {
            dy: -3,
            legPose: "together",
            armL: "up",
            armR: "up",
            handUp: null,
            thought: false,
            mouthOpen: true,
          }
        : {
            dy: 0,
            legPose: "neutral",
            armL: "down",
            armR: "down",
            handUp: null,
            thought: false,
            mouthOpen: false,
          };
    case "praying": {
      // Reverent standing: still → hands folded → slight bow → dua.
      const f = frame % 4;
      if (f === 1)
        return {
          dy: 0,
          legPose: "together",
          armL: "folded",
          armR: "folded",
          handUp: null,
          thought: false,
          mouthOpen: false,
        };
      if (f === 2)
        return {
          dy: 1,
          legPose: "together",
          armL: "down",
          armR: "down",
          handUp: null,
          thought: false,
          mouthOpen: false,
        };
      if (f === 3)
        return {
          dy: 0,
          legPose: "together",
          armL: "dua",
          armR: "dua",
          handUp: null,
          thought: false,
          mouthOpen: false,
        };
      return {
        dy: 0,
        legPose: "together",
        armL: "down",
        armR: "down",
        handUp: null,
        thought: false,
        mouthOpen: false,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Drawing — FRONT view head
// ---------------------------------------------------------------------------

function drawHairBackFront(p: Pix, pal: Palette, style: HairStyle): void {
  const h = pal.hair;
  const hd = pal.hairDark;
  const hl = pal.hairLight;
  switch (style) {
    case "hime": // long straight + blunt sidelocks
      p.rect(10, 4, 28, 30, h);
      p.rect(10, 10, 3, 24, hd);
      p.rect(35, 10, 3, 24, hd);
      p.rect(13, 5, 3, 5, hl);
      p.rect(14, 30, 3, 4, hd); // strand tips
      p.rect(31, 30, 3, 4, hd);
      break;
    case "bob": // neat chin-length bob
      p.rect(11, 4, 26, 4, h);
      p.rect(9, 7, 30, 20, h);
      p.rect(9, 7, 3, 20, hd);
      p.rect(36, 7, 3, 20, hd);
      p.rect(13, 5, 3, 3, hl);
      break;
    case "messy": {
      p.rect(10, 7, 28, 12, h);
      const spikes: Array<[number, number]> = [
        [10, 7],
        [15, 10],
        [21, 8],
        [27, 10],
        [33, 7],
      ];
      for (const [x, hh] of spikes) p.rect(x, 10 - hh, 5, hh, h);
      p.rect(12, 7, 3, 3, hl);
      p.rect(10, 12, 2, 7, hd);
      break;
    }
    case "wavy": {
      p.rect(10, 4, 28, 7, h);
      for (let y = 11; y <= 32; y++) {
        const wob = Math.floor(y / 5) % 2;
        p.rect(7 + wob, y, 6, 1, h);
        p.rect(35 - wob, y, 6, 1, h);
      }
      p.rect(7, 11, 2, 22, hd);
      p.rect(39, 11, 2, 22, hd);
      p.rect(11, 5, 2, 4, hl);
      break;
    }
    case "twintails":
      p.rect(11, 5, 26, 15, h);
      p.rect(2, 10, 9, 26, h); // left tail
      p.rect(37, 10, 9, 26, h); // right tail
      p.rect(2, 10, 2, 26, hd);
      p.rect(44, 10, 2, 26, hd);
      p.rect(4, 12, 2, 20, hl);
      p.rect(39, 12, 2, 20, hl);
      p.rect(3, 10, 7, 3, pal.tie); // ties
      p.rect(38, 10, 7, 3, pal.tie);
      break;
    case "spiky": {
      p.rect(10, 8, 28, 11, h);
      const spikes: Array<[number, number]> = [
        [10, 8],
        [16, 11],
        [23, 9],
        [30, 11],
        [35, 8],
      ];
      for (const [x, hh] of spikes) p.rect(x, 11 - hh, 5, hh, h);
      p.rect(12, 8, 3, 3, hl);
      break;
    }
    case "ponytail":
      p.rect(10, 5, 28, 15, h);
      p.rect(32, 3, 8, 12, h); // tail upper
      p.rect(34, 15, 6, 12, h); // tail mid
      p.rect(35, 27, 4, 8, h); // tail taper
      p.rect(37, 3, 3, 30, hd); // shade
      p.rect(28, 3, 5, 4, pal.tie); // tie
      p.rect(12, 6, 2, 3, hl);
      break;
    case "short": // tidy crop
      p.rect(13, 4, 22, 3, h);
      p.rect(10, 6, 28, 14, h);
      p.rect(10, 6, 3, 14, hd);
      p.rect(14, 4, 3, 2, hl);
      break;
  }
}

function drawFaceFront(p: Pix, pal: Palette): void {
  const s = pal.skin;
  p.rect(14, 10, 20, 14, s);
  p.clear(14, 10, 2, 2);
  p.clear(32, 10, 2, 2);
  p.clear(14, 22, 2, 2);
  p.clear(32, 22, 2, 2);
  // ears
  p.rect(12, 15, 2, 3, s);
  p.rect(34, 15, 2, 3, s);
  // soft cheek shading
  p.rect(14, 21, 20, 1, pal.skinDark);
}

function drawFringeFront(p: Pix, pal: Palette, style: HairStyle): void {
  const h = pal.hair;
  const hd = pal.hairDark;
  const hl = pal.hairLight;
  switch (style) {
    case "hime":
    case "bob":
    case "twintails":
      p.rect(11, 7, 26, 4, h);
      p.rect(11, 10, 4, 2, hd);
      p.rect(33, 10, 4, 2, hd);
      p.rect(13, 7, 4, 1, hl);
      break;
    case "messy":
      p.rect(10, 8, 28, 3, h);
      p.rect(13, 11, 3, 2, h);
      p.rect(21, 11, 4, 2, h);
      p.rect(30, 11, 3, 2, h);
      break;
    case "wavy":
      p.rect(10, 7, 28, 4, h);
      p.rect(10, 10, 5, 2, hd);
      p.rect(12, 7, 4, 1, hl);
      break;
    case "spiky":
      p.rect(10, 9, 28, 3, h);
      p.rect(15, 12, 3, 2, h);
      p.rect(25, 12, 3, 2, h);
      break;
    case "ponytail":
      p.rect(10, 7, 28, 3, h);
      p.rect(10, 10, 16, 2, h); // swept
      p.rect(12, 7, 5, 1, hl);
      break;
    case "short":
      p.rect(10, 8, 28, 3, h);
      p.rect(13, 7, 4, 1, hl);
      break;
  }
}

function drawEyesFront(p: Pix, pal: Palette, blink: boolean): void {
  const d = pal.dark;
  const w = pal.white;
  const e = pal.eye;
  // Big chibi eyes: 6x5 at x16..21 and x26..31, y15..19.
  if (blink) {
    p.rect(15, 17, 7, 1, d);
    p.rect(26, 17, 7, 1, d);
    return;
  }
  for (const x0 of [16, 26]) {
    p.rect(x0 - 1, 15, 8, 1, d); // upper lash
    p.rect(x0, 16, 6, 4, w); // white
    p.rect(x0 + 1, 16, 4, 3, e); // iris
    p.rect(x0 + 1, 16, 2, 1, w); // highlight
    p.rect(x0 + 2, 17, 2, 2, d); // pupil
    p.rect(x0, 19, 6, 1, d); // lower lash
  }
}

function drawFaceDetailsFront(p: Pix, pal: Palette, mouthOpen: boolean): void {
  p.rect(16, 13, 4, 1, pal.hairDark); // brows
  p.rect(28, 13, 4, 1, pal.hairDark);
  p.rect(14, 20, 3, 2, pal.blush); // blush
  p.rect(31, 20, 3, 2, pal.blush);
  if (mouthOpen) p.rect(22, 21, 4, 3, pal.mouthOpen);
  else p.rect(22, 22, 4, 1, pal.mouth);
}

// ---------------------------------------------------------------------------
// Drawing — FRONT view body
// ---------------------------------------------------------------------------

function drawBodyFront(p: Pix, pal: Palette, outfit: OutfitStyle): void {
  const o1 = pal.out1;
  const o1d = pal.out1Dark;
  const o1l = pal.out1Light;
  const o2 = pal.out2;
  const o2d = pal.out2Dark;
  const s = pal.skin;
  // neck
  p.rect(22, 24, 4, 3, s);
  p.rect(22, 26, 4, 1, pal.skinDark);
  // torso base
  const wide = outfit === "cozy";
  const tx = wide ? 14 : 16;
  const tw = wide ? 20 : 16;
  p.rect(tx, 27, tw, 11, o1);
  p.rect(tx, 27, 2, 11, o1d); // left shade
  p.rect(tx + 2, 27, 2, 2, o1l); // collar highlight
  switch (outfit) {
    case "sweater":
      p.rect(15, 33, 18, 6, o2); // skirt
      p.rect(15, 33, 2, 6, o2d);
      p.rect(20, 29, 8, 1, o2); // knit band
      break;
    case "vest":
      p.rect(16, 27, 5, 10, o2); // vest panels
      p.rect(27, 27, 5, 10, o2);
      p.rect(23, 28, 2, 9, o2d); // tie
      p.rect(22, 27, 2, 2, o2d); // collar
      p.rect(26, 27, 2, 2, o2d);
      break;
    case "hoodie":
      p.rect(18, 25, 12, 3, o2); // hood behind neck
      p.rect(20, 33, 8, 4, o2); // pocket
      p.rect(20, 33, 8, 1, o2d);
      p.rect(22, 29, 1, 3, o1d); // drawstrings
      p.rect(25, 29, 1, 3, o1d);
      break;
    case "cozy":
      p.rect(16, 30, 16, 2, o2); // wide knit band
      p.rect(18, 34, 12, 2, o2);
      break;
    case "jacket":
      p.rect(16, 27, 4, 11, o2); // open jacket panels
      p.rect(28, 27, 4, 11, o2);
      p.rect(16, 27, 1, 11, o2d);
      p.rect(31, 27, 1, 11, o2d);
      p.rect(21, 33, 6, 5, o1d); // inner shirt shade
      break;
    case "shirtTie":
      p.rect(23, 28, 2, 9, o2); // tie
      p.rect(23, 28, 2, 2, o2d);
      p.rect(21, 27, 2, 3, o2d); // collar
      p.rect(25, 27, 2, 3, o2d);
      p.rect(18, 36, 12, 1, o1d); // shirt hem
      break;
    case "workJacket":
      p.rect(16, 36, 16, 2, o2); // belt
      p.rect(20, 27, 3, 3, o2); // collar
      p.rect(26, 27, 3, 3, o2);
      p.rect(23, 30, 2, 6, o1d); // placket
      break;
    case "uniform":
      p.rect(14, 27, 5, 2, o2); // epaulets
      p.rect(29, 27, 5, 2, o2);
      p.rect(23, 29, 2, 2, o2); // buttons
      p.rect(23, 33, 2, 2, o2);
      p.rect(16, 36, 16, 1, o1d);
      break;
  }
}

function drawLegsFront(
  p: Pix,
  pal: Palette,
  pose: LegPose,
  legColor: RGB,
  sarong: RGB | null,
): void {
  const sh = pal.shoe;
  if (sarong) {
    // Long sarong (prayer): covers to the shoes, with fold stripes.
    const top = 31;
    p.rect(17, top, 14, 14, sarong);
    p.rect(17, top, 2, 14, pal.out2Dark);
    p.rect(24, top, 1, 14, pal.out2Dark);
    p.rect(17, top + 12, 14, 2, pal.out2Dark);
    p.rect(19, 44, 4, 2, sh);
    p.rect(26, 44, 4, 2, sh);
    return;
  }
  let ll = 19;
  let rl = 26;
  if (pose === "stepL") {
    ll = 16;
    rl = 26;
  } else if (pose === "stepR") {
    ll = 19;
    rl = 28;
  } else if (pose === "together") {
    ll = 20;
    rl = 25;
  }
  const top = 38;
  p.rect(ll, top, 4, 6, legColor);
  p.rect(rl, top, 4, 6, legColor);
  p.rect(ll, top, 1, 6, pal.skinDark);
  p.rect(ll - 1, 44, 6, 2, sh);
  p.rect(rl - 1, 44, 6, 2, sh);
}

function drawArmFront(
  p: Pix,
  pal: Palette,
  side: "L" | "R",
  pose: ArmPose,
  handUp: boolean,
): void {
  const x0 = side === "L" ? 12 : 32;
  const o1 = pal.out1;
  const o1d = pal.out1Dark;
  const s = pal.skin;
  switch (pose) {
    case "down":
      p.rect(x0, 28, 4, 8, o1);
      p.rect(x0, 28, 1, 8, o1d);
      p.rect(x0, 36, 4, 3, s);
      break;
    case "swing":
      p.rect(x0, 28, 4, 8, o1);
      p.rect(x0, 28, 1, 8, o1d);
      p.rect(x0, 37, 4, 3, s);
      break;
    case "typing": {
      // forearms angled inward toward the keyboard, hands alternate height
      const ix = side === "L" ? 14 : 30;
      p.rect(x0, 28, 4, 4, o1);
      p.rect(ix, 32, 4, 4, o1);
      p.rect(ix, handUp ? 34 : 35, 4, 3, s);
      break;
    }
    case "chin": {
      // hand raised to chin (thinking)
      p.rect(x0, 28, 4, 6, o1);
      p.rect(x0, 24, 4, 5, o1);
      p.rect(x0 - 1, 21, 5, 4, s);
      break;
    }
    case "up":
      // arm raised high (celebrate / meeting gesture)
      p.rect(x0, 20, 4, 9, o1);
      p.rect(x0, 20, 1, 9, o1d);
      p.rect(x0, 16, 4, 4, s);
      break;
    case "folded": {
      // hands folded together at the chest (prayer)
      const ix = side === "L" ? 18 : 26;
      p.rect(x0, 28, 4, 4, o1);
      p.rect(ix, 31, 4, 4, o1);
      p.rect(ix, 33, 4, 3, s);
      break;
    }
    case "dua":
      // hands raised to chest height, palms up (prayer)
      p.rect(x0, 26, 4, 7, o1);
      p.rect(x0, 26, 1, 7, o1d);
      p.rect(x0 - 1, 23, 5, 4, s);
      break;
  }
}

function drawAccessoryFront(p: Pix, pal: Palette, acc: AccessoryKind): void {
  const d = pal.dark;
  switch (acc) {
    case "ribbon": {
      // bow on the upper-right of the hair
      const c = pal.out2;
      const cd = pal.out2Dark;
      p.rect(28, 4, 4, 4, c);
      p.rect(36, 4, 4, 4, c);
      p.rect(28, 9, 2, 3, c);
      p.rect(38, 9, 2, 3, c);
      p.rect(32, 4, 4, 5, cd); // knot
      p.rect(33, 5, 2, 2, c);
      break;
    }
    case "roundGlasses":
      for (const x0 of [15, 25]) {
        p.rect(x0, 15, 8, 1, d);
        p.rect(x0, 20, 8, 1, d);
        p.rect(x0, 15, 1, 6, d);
        p.rect(x0 + 7, 15, 1, 6, d);
      }
      p.rect(23, 17, 2, 1, d); // bridge
      break;
    case "headphones":
      p.rect(8, 2, 32, 3, d); // band
      p.rect(8, 5, 3, 3, d);
      p.rect(37, 5, 3, 3, d);
      p.rect(7, 13, 5, 10, d); // ear cups
      p.rect(36, 13, 5, 10, d);
      p.rect(8, 15, 3, 3, pal.out2);
      p.rect(37, 15, 3, 3, pal.out2);
      break;
    case "beret": {
      const c = pal.out2;
      p.rect(14, 2, 20, 6, c); // tilted beret
      p.rect(26, 1, 8, 3, c);
      p.rect(30, 0, 2, 1, pal.out2Dark); // stem
      p.rect(14, 6, 20, 1, pal.out2Dark);
      break;
    }
    case "starPin": {
      // little star on the left of the hair
      const g: RGB = [255, 210, 63];
      p.rect(9, 11, 5, 1, g);
      p.rect(11, 9, 1, 5, g);
      p.rect(10, 10, 3, 3, g);
      break;
    }
    case "rectGlasses":
      for (const x0 of [15, 25]) {
        p.rect(x0, 16, 8, 1, d);
        p.rect(x0, 19, 8, 1, d);
        p.rect(x0, 16, 1, 4, d);
        p.rect(x0 + 7, 16, 1, 4, d);
      }
      p.rect(23, 17, 2, 1, d);
      break;
    case "cap": {
      const c = pal.out2;
      p.rect(14, 1, 20, 4, c); // dome
      p.rect(11, 5, 26, 4, c);
      p.rect(10, 9, 30, 2, c); // brim
      p.rect(22, 0, 4, 2, pal.out2Dark); // button
      break;
    }
    case "headsetMic":
      p.rect(10, 3, 28, 2, d); // thin band
      p.rect(35, 16, 2, 6, d); // boom down the right cheek
      p.rect(30, 21, 5, 2, d);
      p.rect(27, 20, 3, 3, d); // mic tip
      break;
    case "none":
      break;
  }
}

function drawThoughtBubble(p: Pix, pal: Palette): void {
  const w = pal.white;
  p.rect(40, 12, 2, 2, w);
  p.rect(42, 9, 2, 2, w);
  p.rect(38, 2, 9, 2, w);
  p.rect(38, 8, 9, 2, w);
  p.rect(38, 2, 2, 8, w);
  p.rect(45, 2, 2, 8, w);
  p.rect(40, 4, 5, 1, pal.dark);
}
