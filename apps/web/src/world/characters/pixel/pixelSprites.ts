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
 * PROFESSIONAL REDESIGN (2026-10-23): the original chibi look (huge head,
 * anime eyes, blush) was replaced with polished corporate pixel-art —
 * adult ~3.5-heads proportions, tailored office attire (blazer, suit,
 * vest+tie, cardigan, shirt, polo, uniform), mature refined faces with
 * smaller well-defined eyes, neat professional hairstyles with shine
 * bands, and consistent top-left lighting with fabric shading.
 *
 * Design notes:
 * - Pure pixel buffers (Uint8ClampedArray) — no DOM, no Three.js here, so
 *   this module is fully unit-testable. Canvas/texture conversion lives in
 *   the components that need it (PixelAvatar, 2D previews).
 * - Grid is 48x48 px. Sprites are rendered with THREE.NearestFilter, so
 *   the individual pixels stay visible ("agak pixel pixel").
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

/** Sprite grid dimensions (pixels). */
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
  mouth: RGB;
  mouthOpen: RGB;
  out1: RGB;
  out1Dark: RGB;
  out1Light: RGB;
  out2: RGB;
  out2Dark: RGB;
  tie: RGB;
  trouser: RGB;
  trouserDark: RGB;
  shoe: RGB;
  shoeLight: RGB;
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
    mouth: [150, 76, 76],
    mouthOpen: [118, 42, 50],
    out1: hexToRgb(preset.outfitPrimary),
    out1Dark: hexToRgb(shade(preset.outfitPrimary, -0.28)),
    out1Light: hexToRgb(shade(preset.outfitPrimary, 0.25)),
    out2: hexToRgb(preset.outfitSecondary),
    out2Dark: hexToRgb(shade(preset.outfitSecondary, -0.3)),
    tie: hexToRgb(preset.outfitSecondary),
    // Trousers stay dark/neutral (derived from the primary garment) —
    // professional dress, never bright.
    trouser: hexToRgb(shade(preset.outfitPrimary, -0.55)),
    trouserDark: hexToRgb(shade(preset.outfitPrimary, -0.7)),
    shoe: [43, 43, 58],
    shoeLight: [74, 74, 96],
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
// Drawing — FRONT view head (professional adult proportions)
// ---------------------------------------------------------------------------
// Head: face x18-30, y5-17 (12 wide x 12 tall). Smaller refined eyes,
// subtle nose, no blush — a mature professional look.

function drawHairBackFront(p: Pix, pal: Palette, style: HairStyle): void {
  const h = pal.hair;
  const hd = pal.hairDark;
  const hl = pal.hairLight;
  switch (style) {
    case "hime": // long straight, neat — softened professional hime
      p.rect(14, 2, 20, 32, h);
      p.rect(14, 8, 3, 26, hd);
      p.rect(31, 8, 3, 26, hd);
      p.rect(17, 3, 3, 8, hl); // shine band
      p.rect(17, 14, 2, 10, hl);
      p.rect(15, 30, 3, 4, hd); // tapered tips
      p.rect(30, 30, 3, 4, hd);
      break;
    case "bob": // neat chin-length bob, tucked
      p.rect(15, 2, 18, 3, h);
      p.rect(13, 4, 22, 16, h);
      p.rect(13, 4, 3, 16, hd);
      p.rect(32, 4, 3, 16, hd);
      p.rect(17, 3, 3, 5, hl);
      p.rect(14, 18, 3, 2, hd);
      p.rect(31, 18, 3, 2, hd);
      break;
    case "messy": // modern textured crop — neat, not spiky
      p.rect(15, 3, 18, 4, h);
      p.rect(14, 6, 20, 6, h);
      p.rect(16, 3, 2, 3, hl);
      p.rect(22, 4, 3, 2, hl);
      p.rect(14, 8, 2, 4, hd);
      p.rect(31, 6, 2, 5, hd);
      // subtle texture nicks
      p.rect(19, 6, 2, 2, hd);
      p.rect(26, 7, 2, 2, h);
      break;
    case "wavy": // soft professional waves
      p.rect(14, 2, 20, 6, h);
      for (let y = 8; y <= 30; y++) {
        const wob = Math.floor(y / 4) % 2;
        p.rect(12 + wob, y, 5, 1, h);
        p.rect(31 - wob, y, 5, 1, h);
      }
      p.rect(12, 8, 2, 22, hd);
      p.rect(34, 8, 2, 22, hd);
      p.rect(16, 3, 2, 6, hl);
      p.rect(16, 12, 2, 8, hl);
      break;
    case "twintails": // neat low twintails — professional styling
      p.rect(15, 3, 18, 12, h);
      p.rect(6, 10, 7, 20, h); // left tail
      p.rect(35, 10, 7, 20, h); // right tail
      p.rect(6, 10, 2, 20, hd);
      p.rect(40, 10, 2, 20, hd);
      p.rect(8, 12, 2, 14, hl);
      p.rect(37, 12, 2, 14, hl);
      p.rect(7, 10, 5, 2, pal.tie); // ties
      p.rect(36, 10, 5, 2, pal.tie);
      p.rect(16, 4, 2, 4, hl);
      break;
    case "spiky": // swept volume — confident, tidy
      p.rect(15, 2, 18, 4, h);
      p.rect(14, 5, 20, 7, h);
      p.rect(17, 2, 2, 4, hl);
      p.rect(23, 3, 3, 2, hl);
      p.rect(14, 7, 2, 5, hd);
      p.rect(31, 5, 2, 6, hd);
      // gentle swept tips (not anime spikes)
      p.rect(18, 1, 3, 2, h);
      p.rect(25, 1, 3, 2, h);
      break;
    case "ponytail": // sleek high ponytail
      p.rect(15, 3, 18, 11, h);
      p.rect(30, 1, 7, 10, h); // tail upper
      p.rect(31, 11, 5, 12, h); // tail falls
      p.rect(32, 23, 3, 7, h); // taper
      p.rect(34, 1, 3, 26, hd);
      p.rect(27, 2, 4, 3, pal.tie); // tie
      p.rect(17, 4, 2, 4, hl);
      break;
    case "short": // tidy crop with fade
      p.rect(16, 2, 16, 3, h);
      p.rect(14, 4, 20, 9, h);
      p.rect(14, 4, 2, 9, hd);
      p.rect(32, 4, 2, 9, hd);
      p.rect(18, 2, 3, 2, hl);
      break;
    case "wildSpikes": {
      // Voluminous wild spikes (reference character): big jagged mass
      // extending past the head, many sharp individual spikes.
      // Base mass
      p.rect(13, 4, 22, 9, h);
      // Top spikes — tall, sharp triangles
      p.rect(14, 2, 3, 3, h); p.rect(15, 0, 1, 3, h); // spike 1 (left)
      p.rect(18, 1, 4, 4, h); p.rect(19, 0, 2, 2, h); // spike 2
      p.rect(19, 0, 2, 1, hl);
      p.rect(23, 0, 3, 5, h); p.rect(24, 0, 1, 3, h); // spike 3 (tallest)
      p.rect(24, 0, 1, 1, hl);
      p.rect(27, 1, 4, 4, h); p.rect(28, 0, 2, 2, h); // spike 4
      p.rect(28, 0, 2, 1, hl);
      p.rect(32, 1, 3, 4, h); p.rect(33, 0, 1, 3, h); // spike 5 (right)
      // Side spikes (sharp, pointing out)
      p.rect(10, 5, 4, 3, h); p.rect(8, 6, 2, 1, h); // left
      p.rect(34, 5, 4, 3, h); p.rect(38, 6, 2, 1, h); // right
      p.rect(11, 9, 3, 4, h); p.rect(9, 10, 2, 2, h); // left low
      p.rect(34, 9, 3, 4, h); p.rect(37, 10, 2, 2, h); // right low
      // Shading: dark valleys between spikes
      p.rect(17, 3, 2, 3, hd);
      p.rect(22, 4, 1, 4, hd);
      p.rect(26, 4, 1, 4, hd);
      p.rect(31, 3, 2, 4, hd);
      p.rect(31, 4, 4, 9, hd);
      p.rect(13, 11, 22, 2, hd);
      // Highlight: shine on upper-left spikes
      p.rect(19, 1, 2, 2, hl);
      p.rect(15, 4, 2, 3, hl);
      break;
    }
  }
}

function drawFaceFront(p: Pix, pal: Palette): void {
  const s = pal.skin;
  // Mature face: 12 wide (x18-30), 12 tall (y5-17), tapered jaw.
  p.rect(18, 6, 12, 10, s);
  p.rect(19, 5, 10, 1, s);
  p.rect(20, 16, 8, 1, s);
  // ears
  p.rect(17, 10, 1, 3, s);
  p.rect(30, 10, 1, 3, s);
  // top-left light: right edge + jaw shading
  p.rect(29, 6, 1, 9, pal.skinDark);
  p.rect(20, 16, 8, 1, pal.skinDark);
  p.rect(18, 6, 1, 2, pal.skinDark); // temple shade under hairline
}

function drawFringeFront(p: Pix, pal: Palette, style: HairStyle): void {
  const h = pal.hair;
  const hd = pal.hairDark;
  const hl = pal.hairLight;
  switch (style) {
    case "hime":
    case "bob":
    case "twintails":
      // neat straight fringe
      p.rect(17, 4, 14, 3, h);
      p.rect(17, 6, 3, 2, hd);
      p.rect(28, 6, 3, 2, hd);
      p.rect(19, 4, 4, 1, hl);
      break;
    case "messy":
      // textured fringe, side-swept
      p.rect(15, 5, 18, 2, h);
      p.rect(17, 7, 3, 2, h);
      p.rect(24, 7, 4, 2, h);
      p.rect(17, 5, 4, 1, hl);
      break;
    case "wavy":
      p.rect(15, 4, 18, 3, h);
      p.rect(15, 6, 4, 2, hd);
      p.rect(17, 4, 4, 1, hl);
      break;
    case "spiky":
      // swept up, forehead mostly clear
      p.rect(15, 4, 18, 2, h);
      p.rect(20, 6, 3, 1, h);
      p.rect(17, 4, 4, 1, hl);
      break;
    case "ponytail":
      // sleek, side-parted
      p.rect(15, 4, 18, 2, h);
      p.rect(15, 6, 12, 1, h);
      p.rect(17, 4, 5, 1, hl);
      break;
    case "short":
      p.rect(15, 4, 18, 2, h);
      p.rect(18, 4, 4, 1, hl);
      break;
    case "wildSpikes": {
      // Jagged bangs: prominent spikes falling over the forehead,
      // stopping above the brows.
      p.rect(15, 4, 18, 2, h);
      p.rect(16, 6, 2, 1, h); // spike tips
      p.rect(20, 6, 2, 2, h);
      p.rect(20, 6, 1, 1, hl);
      p.rect(24, 6, 3, 1, h);
      p.rect(28, 6, 2, 2, h);
      p.rect(31, 6, 2, 1, h);
      p.rect(14, 5, 2, 3, h); // side lock left
      p.rect(32, 5, 2, 3, h); // side lock right
      break;
    }
  }
}

function drawEyesFront(p: Pix, pal: Palette, blink: boolean, cool = false): void {
  const d = pal.dark;
  const w = pal.white;
  const e = pal.eye;
  if (cool) {
    // Confident half-lidded eyes (reference): heavy upper lid, calm gaze.
    for (const x0 of [19, 25]) {
      p.rect(x0, 10, 5, 2, d); // thick upper lash/lid
      p.rect(x0, 12, 5, 1, w); // white sliver
      p.rect(x0 + 1, 12, 3, 1, e); // iris
      p.rect(x0 + 2, 12, 1, 1, d); // pupil
      p.rect(x0 + 1, 12, 1, 1, w); // catchlight
    }
    if (blink) {
      p.rect(19, 11, 5, 1, d);
      p.rect(25, 11, 5, 1, d);
    }
    return;
  }
  // Refined professional eyes: 5x3 at x19-23 and x25-29, y10-12.
  // Much smaller and calmer than the old 6x5 chibi eyes.
  if (blink) {
    p.rect(19, 11, 5, 1, d);
    p.rect(25, 11, 5, 1, d);
    return;
  }
  for (const x0 of [19, 25]) {
    p.rect(x0, 10, 5, 1, d); // upper lash
    p.rect(x0, 11, 5, 2, w); // white
    p.rect(x0 + 1, 11, 3, 2, e); // iris
    p.rect(x0 + 2, 11, 1, 2, d); // pupil
    p.rect(x0 + 1, 11, 1, 1, w); // catchlight
  }
}

function drawFaceDetailsFront(p: Pix, pal: Palette, mouthOpen: boolean, cool = false): void {
  if (cool) {
    // Thick angled brows (confident) on the forehead, subtle nose, smirk.
    p.rect(18, 7, 5, 2, pal.hairDark); // left brow (thick, angled)
    p.rect(25, 7, 5, 2, pal.hairDark); // right brow (thick, angled)
    p.rect(24, 12, 1, 2, pal.skinDark); // nose hint
    if (mouthOpen) p.rect(22, 14, 4, 2, pal.mouthOpen);
    else {
      p.rect(22, 15, 3, 1, pal.mouth); // smirk
      p.rect(25, 14, 2, 1, pal.mouth);
    }
    return;
  }
  // Defined professional brows (not thick anime).
  p.rect(19, 8, 4, 1, pal.hairDark);
  p.rect(25, 8, 4, 1, pal.hairDark);
  // Subtle nose hint.
  p.rect(24, 12, 1, 2, pal.skinDark);
  // Calm professional mouth.
  if (mouthOpen) p.rect(22, 14, 4, 2, pal.mouthOpen);
  else p.rect(22, 15, 4, 1, pal.mouth);
}

// ---------------------------------------------------------------------------
// Drawing — FRONT view body (tailored professional attire)
// ---------------------------------------------------------------------------
// Torso: x16-32 (16 wide), y19-32. Structured shoulders, lapels, collars,
// ties and buttons — a tailored corporate look.

function drawBodyFront(p: Pix, pal: Palette, outfit: OutfitStyle): void {
  const o1 = pal.out1;
  const o1d = pal.out1Dark;
  const o1l = pal.out1Light;
  const o2 = pal.out2;
  const o2d = pal.out2Dark;
  const s = pal.skin;
  const w = pal.white;
  // neck
  p.rect(22, 17, 4, 3, s);
  p.rect(22, 19, 4, 1, pal.skinDark);
  // torso base with structured shoulders
  p.rect(16, 20, 16, 12, o1);
  p.rect(16, 19, 16, 2, o1); // shoulder line
  p.rect(15, 20, 1, 3, o1); // shoulder caps
  p.rect(32, 20, 1, 3, o1);
  // top-left light: right edge shade, left highlight
  p.rect(31, 20, 1, 12, o1d);
  p.rect(16, 20, 1, 12, o1d);
  p.rect(18, 20, 2, 2, o1l);
  switch (outfit) {
    case "blazer": {
      // Tailored blazer (o1) over blouse (white): lapels + single button.
      p.rect(22, 20, 4, 12, w); // blouse panel
      p.rect(22, 20, 4, 1, pal.skinDark);
      // lapels
      p.rect(20, 20, 2, 5, o1d);
      p.rect(26, 20, 2, 5, o1d);
      p.rect(21, 20, 1, 4, o1l);
      p.rect(26, 20, 1, 4, o1l);
      // blazer front edges
      p.rect(20, 25, 2, 7, o1d);
      p.rect(26, 25, 2, 7, o1d);
      p.rect(23, 27, 2, 2, o2d); // button
      p.rect(17, 30, 14, 2, o1d); // hem shade
      break;
    }
    case "vest": {
      // Dress shirt (o1 light) + vest (o2) + tie.
      p.rect(16, 20, 16, 12, o1); // shirt
      p.rect(16, 20, 1, 12, o1d);
      p.rect(31, 20, 1, 12, o1d);
      p.rect(16, 20, 6, 12, o2); // vest left panel
      p.rect(26, 20, 6, 12, o2); // vest right panel
      p.rect(16, 20, 1, 12, o2d);
      p.rect(31, 20, 1, 12, o2d);
      p.rect(21, 20, 2, 3, o1); // shirt collar V
      p.rect(25, 20, 2, 3, o1);
      p.rect(23, 21, 2, 2, o2d); // tie knot
      p.rect(23, 23, 2, 8, pal.tie); // tie
      p.rect(23, 23, 1, 8, o2d);
      p.rect(18, 30, 2, 2, o2d); // vest buttons
      p.rect(28, 30, 2, 2, o2d);
      break;
    }
    case "smartShirt": {
      // Button-up shirt (o1), collar, placket, chest pocket.
      p.rect(21, 19, 2, 3, o1d); // collar
      p.rect(25, 19, 2, 3, o1d);
      p.rect(23, 20, 2, 12, o1d); // placket shade
      p.rect(24, 22, 1, 1, o2d); // buttons
      p.rect(24, 25, 1, 1, o2d);
      p.rect(24, 28, 1, 1, o2d);
      p.rect(27, 24, 3, 3, o1d); // chest pocket
      p.rect(27, 24, 3, 1, o2d);
      p.rect(17, 30, 14, 2, o1d); // hem
      break;
    }
    case "cardigan": {
      // Blouse (o1 light) + open cardigan (o2).
      p.rect(16, 20, 16, 12, o1); // blouse
      p.rect(22, 20, 4, 12, w); // blouse front panel
      p.rect(16, 20, 5, 12, o2); // cardigan left
      p.rect(27, 20, 5, 12, o2); // cardigan right
      p.rect(16, 20, 1, 12, o2d);
      p.rect(31, 20, 1, 12, o2d);
      p.rect(20, 20, 1, 12, o2d); // cardigan edges
      p.rect(27, 20, 1, 12, o2d);
      p.rect(21, 20, 2, 2, o1d); // blouse neckline
      p.rect(25, 20, 2, 2, o1d);
      p.rect(28, 24, 1, 1, o1d); // cardigan button
      p.rect(28, 27, 1, 1, o1d);
      break;
    }
    case "suit": {
      // Sharp full suit (o1 dark) + white shirt + tie (o2).
      p.rect(22, 20, 4, 12, w); // shirt
      // peaked lapels
      p.rect(19, 20, 3, 6, o1d);
      p.rect(26, 20, 3, 6, o1d);
      p.rect(20, 20, 1, 5, o1l);
      p.rect(27, 20, 1, 5, o1l);
      p.rect(19, 26, 3, 6, o1); // suit fronts close below
      p.rect(26, 26, 3, 6, o1);
      p.rect(23, 21, 2, 2, o2d); // tie knot
      p.rect(23, 23, 2, 7, pal.tie); // tie
      p.rect(24, 23, 1, 7, o2d);
      p.rect(24, 28, 1, 1, w); // shirt button hint
      p.rect(28, 24, 3, 2, w); // pocket square
      p.rect(28, 24, 3, 1, o1d);
      p.rect(17, 30, 14, 2, o1d); // hem
      break;
    }
    case "polo": {
      // Polo shirt (o1): collar + 2-button placket.
      p.rect(21, 19, 2, 3, o1d); // collar
      p.rect(25, 19, 2, 3, o1d);
      p.rect(20, 19, 8, 1, o1d); // collar band
      p.rect(23, 20, 2, 5, o1d); // placket
      p.rect(24, 21, 1, 1, o2d); // buttons
      p.rect(24, 23, 1, 1, o2d);
      p.rect(17, 30, 14, 2, o1d); // hem
      p.rect(18, 21, 2, 8, o1l); // fabric fold highlight
      break;
    }
    case "uniform": {
      // Professional uniform (o1 dark): collar, buttons, shoulder boards.
      p.rect(14, 20, 4, 2, o2); // shoulder boards
      p.rect(30, 20, 4, 2, o2);
      p.rect(14, 20, 4, 1, o2d);
      p.rect(30, 20, 4, 1, o2d);
      p.rect(21, 19, 2, 3, o1d); // collar
      p.rect(25, 19, 2, 3, o1d);
      p.rect(23, 20, 2, 12, o1d); // placket
      p.rect(24, 22, 1, 1, o2); // buttons
      p.rect(24, 26, 1, 1, o2);
      p.rect(24, 30, 1, 1, o2);
      p.rect(27, 24, 4, 3, o1d); // chest pocket
      p.rect(27, 24, 4, 1, o2d);
      p.rect(17, 24, 2, 1, o2); // name tag
      break;
    }
    case "streetTee": {
      // Plain white tee (reference): crew collar, fabric fold lines.
      p.rect(21, 19, 6, 2, o1d); // collar band
      p.rect(22, 19, 4, 1, o1);
      // fold lines (subtle)
      p.rect(19, 23, 3, 1, o1d);
      p.rect(26, 25, 4, 1, o1d);
      p.rect(20, 28, 2, 1, o1d);
      p.rect(28, 28, 2, 1, o1d);
      p.rect(24, 24, 1, 3, o1d); // center drape
      // short sleeves
      p.rect(14, 20, 3, 5, o1);
      p.rect(31, 20, 3, 5, o1);
      p.rect(14, 24, 3, 1, o1d);
      p.rect(31, 24, 3, 1, o1d);
      // messenger strap: over the right shoulder (viewer's left), vertical
      p.rect(17, 20, 2, 10, pal.dark);
      p.rect(17, 20, 1, 10, pal.out1Light);
      p.rect(17, 30, 14, 2, o1d); // hem
      break;
    }
  }
}

function drawLegsFront(
  p: Pix,
  pal: Palette,
  pose: LegPose,
  sarong: RGB | null,
  outfit?: OutfitStyle,
): void {
  const sh = pal.shoe;
  const shl = pal.shoeLight;
  const t = pal.trouser;
  const td = pal.trouserDark;
  if (sarong) {
    // Long sarong (prayer): covers to the shoes, with fold stripes.
    const top = 31;
    p.rect(18, top, 12, 13, sarong);
    p.rect(18, top, 2, 13, pal.out2Dark);
    p.rect(23, top, 1, 13, pal.out2Dark);
    p.rect(18, top + 11, 12, 2, pal.out2Dark);
    p.rect(20, 44, 4, 2, sh);
    p.rect(25, 44, 4, 2, sh);
    return;
  }
  let ll = 19;
  let rl = 25;
  if (pose === "stepL") {
    ll = 16;
    rl = 25;
  } else if (pose === "stepR") {
    ll = 19;
    rl = 28;
  } else if (pose === "together") {
    ll = 20;
    rl = 24;
  }
  if (outfit === "streetTee") {
    // Blue cargo pants (reference): baggy, flap pockets on thighs,
    // cuffed hems. Sneakers: black with white soles + toe caps.
    const c = pal.out2; // cargo blue
    const cd = pal.out2Dark;
    const cl: RGB = [
      Math.min(255, c[0] + 28),
      Math.min(255, c[1] + 28),
      Math.min(255, c[2] + 28),
    ];
    const top = 32;
    // baggy legs
    p.rect(ll - 1, top, 7, 11, c);
    p.rect(rl - 1, top, 7, 11, c);
    p.rect(ll - 1, top, 2, 11, cd); // outer shade
    p.rect(rl + 4, top, 2, 11, cd);
    p.rect(ll + 2, top, 1, 11, cl); // fold highlight
    p.rect(rl + 2, top, 1, 11, cl);
    // flap pockets on thighs (prominent, like the reference)
    p.rect(ll, top + 3, 6, 5, cd); // left pocket
    p.rect(ll, top + 3, 6, 2, c); // flap
    p.rect(ll + 1, top + 5, 1, 2, c); // flap button hint
    p.rect(rl + 1, top + 3, 6, 5, cd); // right pocket
    p.rect(rl + 1, top + 3, 6, 2, c); // flap
    p.rect(rl + 5, top + 5, 1, 2, c);
    // cuffed hems
    p.rect(ll - 1, top + 9, 7, 2, cd);
    p.rect(rl - 1, top + 9, 7, 2, cd);
    // sneakers: black upper, white sole + toe cap
    p.rect(ll - 1, 43, 7, 2, sh);
    p.rect(rl - 1, 43, 7, 2, sh);
    p.rect(ll - 1, 45, 7, 2, pal.white); // white sole
    p.rect(rl - 1, 45, 7, 2, pal.white);
    p.rect(ll + 4, 43, 2, 1, pal.white); // toe cap
    p.rect(rl + 4, 43, 2, 1, pal.white);
    return;
  }
  // Tailored trousers with crease line.
  const top = 32;
  p.rect(ll, top, 5, 11, t);
  p.rect(rl, top, 5, 11, t);
  p.rect(ll + 2, top, 1, 11, td); // crease
  p.rect(rl + 2, top, 1, 11, td);
  p.rect(ll + 4, top, 1, 11, td); // outer shade
  p.rect(rl, top, 1, 11, td);
  // Dress shoes with highlight.
  p.rect(ll - 1, 43, 7, 3, sh);
  p.rect(rl - 1, 43, 7, 3, sh);
  p.rect(ll - 1, 43, 7, 1, shl);
  p.rect(rl - 1, 43, 7, 1, shl);
}

function drawArmFront(
  p: Pix,
  pal: Palette,
  preset: CharacterPreset,
  side: "L" | "R",
  pose: ArmPose,
  handUp: boolean,
): void {
  const x0 = side === "L" ? 11 : 33;
  const s = pal.skin;
  // Sleeve color: vest arms show the shirt (out1); others show out1.
  // smartShirt has rolled sleeves → forearm skin.
  const outfit = preset.outfitStyle;
  const rolled = outfit === "smartShirt";
  const o1 = pal.out1;
  const o1d = pal.out1Dark;
  // streetTee: hands in pockets (reference) — arms end at the hips.
  if (outfit === "streetTee" && (pose === "down" || pose === "swing")) {
    p.rect(x0, 20, 5, 8, o1); // sleeve
    p.rect(x0, 20, 1, 8, o1d);
    p.rect(x0 + 4, 20, 1, 8, o1d);
    p.rect(x0 + 1, 28, 3, 3, o1d); // hand tucked into pocket
    return;
  }
  switch (pose) {
    case "down":
    case "swing": {
      const drop = pose === "swing" ? 1 : 0;
      p.rect(x0, 20, 5, 8, o1);
      p.rect(x0, 20, 1, 8, o1d);
      p.rect(x0 + 4, 20, 1, 8, o1d);
      if (rolled) {
        p.rect(x0, 26, 5, 3, o1d); // rolled cuff
        p.rect(x0, 29 + drop, 5, 4, s); // forearm
      } else {
        p.rect(x0, 28, 5, 3, s); // hand
        p.rect(x0, 28 + drop, 5, 1, pal.skinDark);
      }
      if (rolled) p.rect(x0, 29 + drop, 5, 1, pal.skinDark);
      break;
    }
    case "typing": {
      // forearms angled inward toward the keyboard
      const ix = side === "L" ? 14 : 29;
      p.rect(x0, 20, 5, 5, o1);
      p.rect(ix, 25, 5, 4, rolled ? s : o1);
      if (!rolled) p.rect(ix, 25, 1, 4, o1d);
      p.rect(ix, handUp ? 28 : 29, 5, 3, s);
      p.rect(ix, handUp ? 28 : 29, 5, 1, pal.skinDark);
      break;
    }
    case "chin": {
      // hand raised to chin (thinking)
      p.rect(x0, 20, 5, 6, o1);
      p.rect(x0, 20, 1, 6, o1d);
      p.rect(x0 + (side === "L" ? -1 : 1), 14, 5, 5, o1);
      p.rect(x0 + (side === "L" ? 0 : 1), 13, 4, 4, s);
      break;
    }
    case "up":
      // arm raised high (celebrate / meeting gesture)
      p.rect(x0, 12, 5, 9, o1);
      p.rect(x0, 12, 1, 9, o1d);
      p.rect(x0, 8, 5, 4, s);
      p.rect(x0, 8, 5, 1, pal.skinDark);
      break;
    case "folded": {
      // hands folded together at the chest (prayer)
      const ix = side === "L" ? 17 : 26;
      p.rect(x0, 20, 5, 5, o1);
      p.rect(ix, 24, 5, 4, o1);
      p.rect(ix, 26, 5, 3, s);
      break;
    }
    case "dua":
      // hands raised to chest height, palms up (prayer)
      p.rect(x0, 20, 5, 7, o1);
      p.rect(x0, 20, 1, 7, o1d);
      p.rect(x0 - 1, 16, 6, 4, s);
      break;
  }
}

function drawAccessoryFront(p: Pix, pal: Palette, acc: AccessoryKind): void {
  const d = pal.dark;
  switch (acc) {
    case "ribbon": {
      // Small elegant bow on the upper-right of the hair
      const c = pal.out2;
      const cd = pal.out2Dark;
      p.rect(30, 2, 3, 3, c);
      p.rect(35, 2, 3, 3, c);
      p.rect(33, 2, 2, 4, cd);
      p.rect(33, 3, 2, 1, c);
      break;
    }
    case "roundGlasses":
      for (const x0 of [18, 25]) {
        p.rect(x0, 10, 6, 1, d);
        p.rect(x0, 12, 6, 1, d);
        p.rect(x0, 10, 1, 3, d);
        p.rect(x0 + 5, 10, 1, 3, d);
      }
      p.rect(24, 11, 1, 1, d); // bridge
      break;
    case "headphones":
      p.rect(12, 1, 24, 2, d); // band
      p.rect(12, 3, 2, 3, d);
      p.rect(34, 3, 2, 3, d);
      p.rect(11, 9, 4, 8, d); // ear cups
      p.rect(33, 9, 4, 8, d);
      p.rect(12, 12, 2, 2, pal.out2);
      p.rect(34, 12, 2, 2, pal.out2);
      break;
    case "beret": {
      const c = pal.out2;
      p.rect(16, 1, 16, 4, c); // tilted beret
      p.rect(26, 0, 6, 2, c);
      p.rect(28, 0, 2, 1, pal.out2Dark); // stem
      p.rect(16, 4, 16, 1, pal.out2Dark);
      break;
    }
    case "starPin": {
      // small star pin on the left of the hair
      const g: RGB = [255, 210, 63];
      p.rect(13, 8, 4, 1, g);
      p.rect(14, 7, 2, 3, g);
      break;
    }
    case "rectGlasses":
      for (const x0 of [18, 25]) {
        p.rect(x0, 10, 6, 1, d);
        p.rect(x0, 12, 6, 1, d);
        p.rect(x0, 10, 1, 3, d);
        p.rect(x0 + 5, 10, 1, 3, d);
      }
      p.rect(24, 11, 1, 1, d);
      break;
    case "cap": {
      const c = pal.out2;
      p.rect(16, 0, 16, 3, c); // dome
      p.rect(14, 3, 20, 3, c);
      p.rect(13, 6, 24, 2, c); // brim
      p.rect(23, 0, 2, 1, pal.out2Dark); // button
      break;
    }
    case "headsetMic":
      p.rect(14, 2, 20, 2, d); // thin band
      p.rect(31, 11, 2, 5, d); // boom down the right cheek
      p.rect(27, 14, 4, 2, d);
      p.rect(25, 13, 2, 2, d); // mic tip
      break;
    case "messengerBag": {
      // Black messenger bag on the viewer's-left hip (reference).
      const b = pal.dark;
      const bd = pal.outline;
      p.rect(7, 28, 8, 10, b); // bag body
      p.rect(7, 28, 8, 2, bd); // top flap shade
      p.rect(7, 28, 1, 10, bd); // left edge
      p.rect(9, 30, 4, 5, bd); // front pocket
      p.rect(9, 30, 4, 1, b);
      p.rect(10, 36, 2, 1, pal.shoeLight); // buckle hint
      break;
    }
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

// ---------------------------------------------------------------------------
// Drawing — SIDE view head (facing sprite-local +x, professional profile)
// ---------------------------------------------------------------------------

function drawHairBackSide(p: Pix, pal: Palette, style: HairStyle): void {
  const h = pal.hair;
  const hd = pal.hairDark;
  const hl = pal.hairLight;
  switch (style) {
    case "hime":
      p.rect(12, 2, 20, 32, h);
      p.rect(12, 8, 3, 26, hd);
      p.rect(15, 3, 2, 8, hl);
      p.rect(15, 14, 2, 10, hl);
      p.rect(13, 30, 3, 4, hd);
      break;
    case "bob":
      p.rect(13, 2, 18, 3, h);
      p.rect(11, 4, 20, 16, h);
      p.rect(11, 4, 3, 16, hd);
      p.rect(14, 3, 2, 5, hl);
      break;
    case "messy":
      p.rect(13, 3, 18, 4, h);
      p.rect(12, 6, 20, 6, h);
      p.rect(14, 3, 2, 3, hl);
      p.rect(20, 4, 3, 2, hl);
      p.rect(12, 8, 2, 4, hd);
      break;
    case "wavy": {
      p.rect(12, 2, 20, 6, h);
      for (let y = 8; y <= 30; y++) {
        const wob = Math.floor(y / 4) % 2;
        p.rect(10 + wob, y, 5, 1, h);
      }
      p.rect(10, 8, 2, 22, hd);
      p.rect(14, 3, 2, 6, hl);
      break;
    }
    case "twintails":
      p.rect(13, 3, 18, 12, h);
      p.rect(4, 10, 7, 20, h); // tail streams behind
      p.rect(4, 10, 2, 20, hd);
      p.rect(6, 12, 2, 14, hl);
      p.rect(5, 10, 5, 2, pal.tie);
      p.rect(14, 4, 2, 4, hl);
      break;
    case "spiky":
      p.rect(13, 2, 18, 4, h);
      p.rect(12, 5, 20, 7, h);
      p.rect(15, 2, 2, 4, hl);
      p.rect(21, 3, 3, 2, hl);
      p.rect(12, 7, 2, 5, hd);
      p.rect(16, 1, 3, 2, h);
      break;
    case "ponytail":
      p.rect(13, 3, 18, 11, h);
      p.rect(6, 1, 7, 10, h); // tail sweeps back
      p.rect(5, 11, 5, 12, h);
      p.rect(5, 1, 2, 22, hd);
      p.rect(10, 2, 4, 3, pal.tie);
      p.rect(15, 4, 2, 4, hl);
      break;
    case "short":
      p.rect(14, 2, 16, 3, h);
      p.rect(12, 4, 20, 9, h);
      p.rect(12, 4, 2, 9, hd);
      p.rect(16, 2, 3, 2, hl);
      break;
    case "wildSpikes": {
      // Wild spikes in profile: big jagged silhouette.
      p.rect(11, 3, 22, 10, h);
      p.rect(13, 0, 4, 4, h); p.rect(14, 0, 2, 1, hl); // top spike
      p.rect(19, 0, 4, 4, h); // top spike 2
      p.rect(25, 1, 4, 3, h); p.rect(26, 0, 2, 1, h); // top spike 3
      p.rect(8, 5, 4, 3, h); p.rect(7, 6, 2, 1, h); // back spike
      p.rect(31, 5, 4, 3, h); // front spike
      p.rect(9, 9, 3, 4, h); // back low
      p.rect(11, 3, 3, 10, hd); // back shade
      p.rect(28, 3, 5, 10, hd); // front shade
      p.rect(14, 2, 3, 2, hl); // shine
      break;
    }
  }
}

function drawFaceSide(p: Pix, pal: Palette): void {
  const s = pal.skin;
  // Professional profile: forehead → nose → lips → chin.
  p.rect(18, 5, 14, 12, s);
  p.rect(32, 10, 3, 3, s); // nose bridge + tip
  p.rect(33, 13, 2, 1, s); // nose base
  p.rect(31, 15, 3, 2, s); // chin/jaw
  p.rect(18, 5, 2, 2, pal.skinDark); // temple shade
  p.rect(18, 15, 12, 1, pal.skinDark); // jaw shade
  p.rect(16, 10, 2, 3, s); // ear (far side)
}

function drawFringeSide(p: Pix, pal: Palette, style: HairStyle): void {
  const h = pal.hair;
  const hd = pal.hairDark;
  const hl = pal.hairLight;
  switch (style) {
    case "messy":
      p.rect(16, 5, 16, 2, h);
      p.rect(20, 7, 3, 2, h);
      p.rect(18, 5, 4, 1, hl);
      break;
    case "spiky":
      p.rect(16, 4, 16, 2, h);
      p.rect(22, 6, 3, 1, h);
      p.rect(18, 4, 4, 1, hl);
      break;
    case "ponytail":
      p.rect(15, 4, 17, 2, h);
      p.rect(15, 6, 10, 1, h);
      p.rect(17, 4, 5, 1, hl);
      break;
    case "wavy":
      p.rect(15, 4, 17, 3, h);
      p.rect(15, 6, 3, 2, hd);
      p.rect(17, 4, 4, 1, hl);
      break;
    case "wildSpikes":
      // Jagged bangs in profile.
      p.rect(16, 4, 16, 2, h);
      p.rect(24, 6, 3, 2, h);
      p.rect(29, 6, 2, 3, h);
      p.rect(18, 4, 4, 1, hl);
      break;
    default:
      p.rect(16, 4, 15, 3, h);
      p.rect(16, 6, 3, 2, hd);
      p.rect(18, 4, 4, 1, hl);
      break;
  }
}

function drawEyeSide(p: Pix, pal: Palette, blink: boolean, cool = false): void {
  const d = pal.dark;
  const w = pal.white;
  const e = pal.eye;
  // Single refined profile eye at x27-31, y10-12.
  if (blink) {
    p.rect(27, 11, 5, 1, d);
    return;
  }
  if (cool) {
    // Half-lidded cool gaze in profile.
    p.rect(27, 10, 5, 2, d);
    p.rect(27, 12, 5, 1, w);
    p.rect(28, 12, 3, 1, e);
    p.rect(29, 12, 1, 1, d);
    return;
  }
  p.rect(27, 10, 5, 1, d);
  p.rect(27, 11, 5, 2, w);
  p.rect(28, 11, 3, 2, e);
  p.rect(29, 11, 1, 2, d);
  p.rect(28, 11, 1, 1, w);
}

function drawFaceDetailsSide(p: Pix, pal: Palette, mouthOpen: boolean, cool = false): void {
  if (cool) {
    p.rect(26, 7, 5, 1, pal.hairDark); // thick angled brow
    p.rect(27, 8, 4, 1, pal.hairDark);
  } else {
    p.rect(27, 8, 4, 1, pal.hairDark); // brow
  }
  p.rect(32, 13, 2, 1, pal.skinDark); // nostril hint
  if (mouthOpen) p.rect(30, 15, 3, 2, pal.mouthOpen);
  else p.rect(30, 15, 3, 1, pal.mouth);
}

// ---------------------------------------------------------------------------
// Drawing — SIDE view body
// ---------------------------------------------------------------------------

function drawBodySide(p: Pix, pal: Palette, outfit: OutfitStyle): void {
  const o1 = pal.out1;
  const o1d = pal.out1Dark;
  const o1l = pal.out1Light;
  const o2 = pal.out2;
  const o2d = pal.out2Dark;
  const s = pal.skin;
  const w = pal.white;
  p.rect(22, 17, 5, 3, s); // neck
  p.rect(22, 19, 5, 1, pal.skinDark);
  p.rect(18, 20, 15, 12, o1); // torso (narrower in profile)
  p.rect(18, 20, 2, 12, o1d); // back shade
  p.rect(21, 20, 2, 2, o1l);
  switch (outfit) {
    case "blazer":
      p.rect(29, 20, 4, 12, o1); // front panel
      p.rect(27, 20, 2, 6, o1d); // lapel
      p.rect(29, 20, 2, 8, w); // blouse hint
      p.rect(29, 27, 1, 1, o2d); // button
      break;
    case "vest":
      p.rect(18, 20, 5, 12, o2); // vest back panel
      p.rect(18, 20, 1, 12, o2d);
      p.rect(29, 22, 2, 7, pal.tie); // tie in profile
      break;
    case "smartShirt":
      p.rect(24, 19, 3, 3, o1d); // collar
      p.rect(25, 22, 1, 1, o2d);
      p.rect(25, 26, 1, 1, o2d);
      break;
    case "cardigan":
      p.rect(18, 20, 4, 12, o2); // cardigan back
      p.rect(18, 20, 1, 12, o2d);
      p.rect(29, 20, 3, 12, o1); // blouse front
      break;
    case "suit":
      p.rect(29, 20, 4, 12, o1);
      p.rect(27, 20, 2, 6, o1d); // lapel
      p.rect(29, 20, 2, 7, w); // shirt
      p.rect(30, 21, 1, 6, pal.tie); // tie edge
      break;
    case "polo":
      p.rect(24, 19, 3, 3, o1d); // collar
      p.rect(25, 21, 1, 1, o2d);
      break;
    case "uniform":
      p.rect(18, 20, 4, 2, o2); // shoulder board
      p.rect(24, 19, 3, 3, o1d); // collar
      p.rect(25, 22, 1, 1, o2);
      p.rect(25, 26, 1, 1, o2);
      break;
    case "streetTee": {
      // White tee in profile: collar, folds, strap over shoulder.
      p.rect(24, 19, 3, 2, o1d); // collar
      p.rect(20, 23, 3, 1, o1d); // fold
      p.rect(22, 27, 2, 1, o1d);
      p.rect(20, 20, 2, 8, pal.dark); // strap (behind, over shoulder)
      break;
    }
  }
}

function drawLegsSide(
  p: Pix,
  pal: Palette,
  pose: LegPose,
  sarong: RGB | null,
  outfit?: OutfitStyle,
): void {
  const sh = pal.shoe;
  const shl = pal.shoeLight;
  const t = pal.trouser;
  const td = pal.trouserDark;
  const top = 32;
  if (sarong) {
    p.rect(19, 31, 12, 13, sarong);
    p.rect(19, 31, 2, 13, pal.out2Dark);
    p.rect(24, 31, 1, 13, pal.out2Dark);
    p.rect(19, 42, 12, 2, pal.out2Dark);
    p.rect(21, 44, 5, 2, sh);
    p.rect(27, 44, 5, 2, sh);
    return;
  }
  // In profile the two legs overlap; stride shifts them along x.
  let back = 20;
  let front = 24;
  if (pose === "stepL") {
    back = 18;
    front = 26;
  } else if (pose === "stepR") {
    back = 22;
    front = 24;
  } else if (pose === "together") {
    back = 21;
    front = 23;
  }
  if (outfit === "streetTee") {
    // Cargo pants in profile: baggy, side pocket, sneakers.
    const c = pal.out2;
    const cd = pal.out2Dark;
    p.rect(back - 1, top, 7, 11, cd); // far leg
    p.rect(front - 1, top, 7, 11, c); // near leg
    p.rect(front + 1, top + 3, 4, 4, cd); // side cargo pocket
    p.rect(front + 1, top + 3, 4, 1, c);
    p.rect(back - 1, top + 9, 7, 2, cd); // cuffs
    p.rect(front - 1, top + 9, 7, 2, cd);
    p.rect(back - 1, 43, 7, 2, sh);
    p.rect(front - 1, 43, 7, 2, sh);
    p.rect(back - 1, 45, 7, 2, pal.white); // white soles
    p.rect(front - 1, 45, 7, 2, pal.white);
    p.rect(front + 4, 43, 2, 1, pal.white); // toe cap
    return;
  }
  p.rect(back, top, 5, 11, td); // far leg (shaded)
  p.rect(front, top, 5, 11, t); // near leg
  p.rect(front + 2, top, 1, 11, td); // crease
  p.rect(back - 1, 43, 7, 3, sh);
  p.rect(front - 1, 43, 7, 3, sh);
  p.rect(back - 1, 43, 7, 1, shl);
  p.rect(front - 1, 43, 7, 1, shl);
}

function drawArmSide(
  p: Pix,
  pal: Palette,
  preset: CharacterPreset,
  pose: ArmPose,
  handUp: boolean,
): void {
  const o1 = pal.out1;
  const o1d = pal.out1Dark;
  const s = pal.skin;
  const rolled = preset.outfitStyle === "smartShirt";
  const x0 = 27; // near arm (front side of the body)
  // streetTee: hand in pocket in profile.
  if (preset.outfitStyle === "streetTee" && (pose === "down" || pose === "swing")) {
    p.rect(x0, 20, 5, 8, o1);
    p.rect(x0, 20, 1, 8, o1d);
    p.rect(x0 + 1, 28, 3, 3, o1d);
    if (pose === "down" || pose === "swing") {
      p.rect(19, 21, 3, 7, o1d); // far arm hint
    }
    return;
  }
  switch (pose) {
    case "down":
    case "swing": {
      const drop = pose === "swing" ? 1 : 0;
      p.rect(x0, 20, 5, 8, o1);
      p.rect(x0, 20, 1, 8, o1d);
      if (rolled) {
        p.rect(x0, 26, 5, 3, o1d);
        p.rect(x0, 29 + drop, 5, 4, s);
      } else {
        p.rect(x0, 28 + drop, 5, 3, s);
      }
      break;
    }
    case "typing":
      // near forearm reaches forward toward the keyboard
      p.rect(x0, 20, 5, 5, o1);
      p.rect(x0 + 2, 25, 6, 4, rolled ? s : o1);
      p.rect(x0 + 3, handUp ? 28 : 29, 5, 3, s);
      break;
    case "chin":
      p.rect(x0, 20, 5, 6, o1);
      p.rect(x0 + 1, 14, 5, 5, o1);
      p.rect(x0 + 1, 13, 5, 4, s);
      break;
    case "up":
      p.rect(x0, 12, 5, 9, o1);
      p.rect(x0, 12, 1, 9, o1d);
      p.rect(x0, 8, 5, 4, s);
      break;
    case "folded":
      p.rect(x0, 20, 5, 5, o1);
      p.rect(x0 - 4, 24, 6, 4, o1);
      p.rect(x0 - 4, 26, 6, 3, s);
      break;
    case "dua":
      p.rect(x0, 20, 5, 7, o1);
      p.rect(x0, 20, 1, 7, o1d);
      p.rect(x0 - 1, 16, 6, 4, s);
      break;
  }
  // Far arm hint (behind the torso).
  if (pose === "down" || pose === "swing") {
    p.rect(19, 21, 3, 7, o1d);
  }
}

function drawAccessorySide(p: Pix, pal: Palette, acc: AccessoryKind): void {
  const d = pal.dark;
  switch (acc) {
    case "ribbon": {
      const c = pal.out2;
      const cd = pal.out2Dark;
      // small bow at the back of the hair
      p.rect(6, 3, 3, 3, c);
      p.rect(11, 3, 3, 3, c);
      p.rect(9, 2, 2, 4, cd);
      break;
    }
    case "roundGlasses":
      p.rect(26, 10, 6, 1, d);
      p.rect(26, 12, 6, 1, d);
      p.rect(26, 10, 1, 3, d);
      p.rect(31, 10, 1, 3, d);
      break;
    case "headphones":
      p.rect(12, 1, 22, 2, d);
      p.rect(12, 3, 2, 3, d);
      p.rect(11, 9, 4, 8, d);
      p.rect(12, 12, 2, 2, pal.out2);
      break;
    case "beret": {
      const c = pal.out2;
      p.rect(14, 1, 16, 4, c);
      p.rect(14, 4, 16, 1, pal.out2Dark);
      break;
    }
    case "starPin": {
      const g: RGB = [255, 210, 63];
      p.rect(13, 8, 4, 1, g);
      p.rect(14, 7, 2, 3, g);
      break;
    }
    case "rectGlasses":
      p.rect(26, 10, 6, 1, d);
      p.rect(26, 12, 6, 1, d);
      p.rect(26, 10, 1, 3, d);
      p.rect(31, 10, 1, 3, d);
      break;
    case "cap": {
      const c = pal.out2;
      p.rect(14, 0, 18, 3, c);
      p.rect(12, 3, 20, 3, c);
      p.rect(30, 6, 7, 2, c); // brim points forward (+x)
      p.rect(22, 0, 2, 1, pal.out2Dark);
      break;
    }
    case "headsetMic":
      p.rect(12, 2, 22, 2, d);
      p.rect(30, 11, 2, 4, d);
      p.rect(27, 13, 3, 2, d);
      break;
    case "messengerBag": {
      // Bag behind the hip in profile (far side).
      const b = pal.dark;
      p.rect(12, 28, 7, 10, b);
      p.rect(12, 28, 7, 2, pal.outline);
      break;
    }
    case "none":
      break;
  }
}

// ---------------------------------------------------------------------------
// Drawing — BACK view (no face; hair covers the head)
// ---------------------------------------------------------------------------

function drawHairBackView(p: Pix, pal: Palette, style: HairStyle): void {
  const h = pal.hair;
  const hd = pal.hairDark;
  const hl = pal.hairLight;
  switch (style) {
    case "hime":
      p.rect(14, 2, 20, 33, h);
      p.rect(14, 2, 4, 33, hd);
      p.rect(30, 2, 4, 33, hd);
      p.rect(19, 3, 4, 10, hl); // sheen band
      p.rect(19, 16, 3, 12, hl);
      p.rect(15, 31, 3, 4, hd);
      p.rect(30, 31, 3, 4, hd);
      break;
    case "bob":
      p.rect(15, 2, 18, 3, h);
      p.rect(13, 4, 22, 17, h);
      p.rect(13, 4, 4, 17, hd);
      p.rect(31, 4, 4, 17, hd);
      p.rect(19, 5, 5, 7, hl);
      break;
    case "messy":
      p.rect(15, 3, 18, 4, h);
      p.rect(14, 6, 20, 8, h);
      p.rect(17, 3, 4, 4, hl);
      p.rect(14, 8, 3, 6, hd);
      break;
    case "wavy": {
      p.rect(14, 2, 20, 6, h);
      for (let y = 8; y <= 32; y++) {
        const wob = Math.floor(y / 4) % 2;
        p.rect(12 + wob, y, 24 - wob * 2, 1, h);
      }
      p.rect(12, 8, 3, 24, hd);
      p.rect(33, 8, 3, 24, hd);
      p.rect(18, 4, 4, 8, hl);
      p.rect(20, 16, 3, 10, hl);
      break;
    }
    case "twintails":
      p.rect(15, 3, 18, 12, h);
      p.rect(6, 10, 7, 22, h);
      p.rect(35, 10, 7, 22, h);
      p.rect(6, 10, 2, 22, hd);
      p.rect(40, 10, 2, 22, hd);
      p.rect(18, 4, 5, 6, hl);
      p.rect(8, 12, 2, 16, hl);
      p.rect(37, 12, 2, 16, hl);
      p.rect(7, 10, 5, 2, pal.tie);
      p.rect(36, 10, 5, 2, pal.tie);
      break;
    case "spiky":
      p.rect(15, 2, 18, 4, h);
      p.rect(14, 5, 20, 9, h);
      p.rect(17, 2, 4, 4, hl);
      p.rect(14, 7, 3, 7, hd);
      break;
    case "ponytail":
      p.rect(15, 3, 18, 11, h);
      p.rect(21, 1, 7, 12, h); // tail falls down the back
      p.rect(22, 13, 5, 14, h);
      p.rect(25, 1, 3, 26, hd);
      p.rect(21, 1, 6, 3, pal.tie);
      p.rect(17, 4, 4, 6, hl);
      break;
    case "short":
      p.rect(16, 2, 16, 3, h);
      p.rect(14, 4, 20, 10, h);
      p.rect(14, 4, 3, 10, hd);
      p.rect(19, 4, 5, 4, hl);
      break;
    case "wildSpikes": {
      // Wild spikes from behind: full jagged crown.
      p.rect(12, 2, 24, 12, h);
      p.rect(14, 0, 4, 3, h); p.rect(15, 0, 2, 1, hl);
      p.rect(20, 0, 4, 3, h);
      p.rect(26, 0, 4, 3, h); p.rect(27, 0, 2, 1, hl);
      p.rect(32, 1, 4, 3, h);
      p.rect(8, 5, 5, 4, h); p.rect(7, 6, 2, 2, h);
      p.rect(35, 5, 5, 4, h); p.rect(38, 6, 2, 2, h);
      p.rect(10, 10, 4, 4, h);
      p.rect(34, 10, 4, 4, h);
      p.rect(12, 2, 4, 12, hd);
      p.rect(32, 2, 4, 12, hd);
      p.rect(17, 2, 3, 3, hl);
      p.rect(24, 3, 2, 4, hl);
      break;
    }
  }
}

function drawBodyBack(p: Pix, pal: Palette, outfit: OutfitStyle): void {
  const o1 = pal.out1;
  const o1d = pal.out1Dark;
  const o1l = pal.out1Light;
  const o2 = pal.out2;
  const o2d = pal.out2Dark;
  p.rect(16, 20, 16, 12, o1); // torso back
  p.rect(16, 20, 2, 12, o1d);
  p.rect(30, 20, 2, 12, o1d);
  p.rect(20, 20, 3, 2, o1l); // shoulder highlight
  switch (outfit) {
    case "blazer":
      p.rect(22, 19, 4, 3, o1d); // collar
      p.rect(16, 22, 16, 1, o1d); // back seam
      p.rect(22, 26, 4, 1, o2d); // back vent
      break;
    case "vest":
      p.rect(16, 20, 16, 12, o2); // vest covers the back
      p.rect(16, 20, 2, 12, o2d);
      p.rect(30, 20, 2, 12, o2d);
      p.rect(22, 24, 4, 2, o1d); // back strap
      break;
    case "smartShirt":
      p.rect(20, 19, 8, 2, o1d); // yoke
      p.rect(23, 21, 2, 10, o1d); // back pleat
      break;
    case "cardigan":
      p.rect(16, 20, 16, 12, o2); // cardigan back
      p.rect(16, 20, 2, 12, o2d);
      p.rect(30, 20, 2, 12, o2d);
      p.rect(22, 22, 4, 1, o1d);
      break;
    case "suit":
      p.rect(22, 19, 4, 3, o1d); // collar
      p.rect(16, 22, 16, 1, o1d); // back seam
      p.rect(23, 26, 2, 5, o1d); // center vent
      break;
    case "polo":
      p.rect(21, 19, 6, 2, o1d); // collar band
      break;
    case "uniform":
      p.rect(14, 20, 4, 2, o2); // shoulder boards
      p.rect(30, 20, 4, 2, o2);
      p.rect(22, 19, 4, 2, o1d); // collar
      break;
    case "streetTee":
      p.rect(21, 19, 6, 2, o1d); // collar band
      p.rect(19, 24, 3, 1, o1d); // fold
      p.rect(26, 27, 3, 1, o1d);
      p.rect(24, 20, 2, 10, pal.dark); // strap across the back
      break;
  }
}

function drawArmBack(
  p: Pix,
  pal: Palette,
  preset: CharacterPreset,
  side: "L" | "R",
  pose: ArmPose,
): void {
  const x0 = side === "L" ? 11 : 32;
  const o1 = pal.out1;
  const o1d = pal.out1Dark;
  const s = pal.skin;
  const rolled = preset.outfitStyle === "smartShirt";
  // streetTee: hands in pockets from behind too.
  if (preset.outfitStyle === "streetTee" && (pose === "down" || pose === "swing")) {
    p.rect(x0, 20, 5, 8, o1);
    p.rect(x0, 20, 1, 8, o1d);
    p.rect(x0 + 1, 28, 3, 3, o1d);
    return;
  }
  switch (pose) {
    case "up":
      p.rect(x0, 12, 5, 9, o1);
      p.rect(x0, 12, 1, 9, o1d);
      p.rect(x0, 8, 5, 4, s);
      break;
    case "typing":
      // from behind: upper arms only, forearms hidden by the torso
      p.rect(x0, 20, 5, 6, o1);
      p.rect(x0, 20, 1, 6, o1d);
      break;
    case "chin":
      p.rect(x0, 20, 5, 6, o1);
      break;
    case "folded":
    case "dua":
      // arms cross in front — barely visible from behind
      p.rect(x0, 21, 5, 5, o1);
      break;
    default: {
      const drop = pose === "swing" ? 1 : 0;
      p.rect(x0, 20, 5, 8, o1);
      p.rect(x0, 20, 1, 8, o1d);
      p.rect(x0 + 4, 20, 1, 8, o1d);
      if (rolled) {
        p.rect(x0, 26, 5, 3, o1d);
        p.rect(x0, 29 + drop, 5, 4, s);
      } else {
        p.rect(x0, 28 + drop, 5, 3, s);
      }
      break;
    }
  }
}

function drawAccessoryBack(p: Pix, pal: Palette, acc: AccessoryKind): void {
  const d = pal.dark;
  switch (acc) {
    case "ribbon": {
      const c = pal.out2;
      const cd = pal.out2Dark;
      p.rect(20, 3, 4, 4, c);
      p.rect(26, 3, 4, 4, c);
      p.rect(23, 2, 3, 5, cd);
      p.rect(24, 3, 1, 2, c);
      break;
    }
    case "headphones":
      p.rect(12, 1, 24, 2, d);
      p.rect(11, 9, 4, 8, d);
      p.rect(33, 9, 4, 8, d);
      break;
    case "beret": {
      const c = pal.out2;
      p.rect(16, 1, 16, 4, c);
      p.rect(16, 4, 16, 1, pal.out2Dark);
      break;
    }
    case "starPin": {
      const g: RGB = [255, 210, 63];
      p.rect(31, 8, 4, 1, g);
      p.rect(32, 7, 2, 3, g);
      break;
    }
    case "cap": {
      const c = pal.out2;
      p.rect(16, 0, 16, 3, c);
      p.rect(14, 3, 20, 3, c);
      p.rect(23, 0, 2, 1, pal.out2Dark);
      break;
    }
    case "headsetMic":
      p.rect(14, 2, 20, 2, d);
      break;
    case "roundGlasses":
    case "rectGlasses":
    case "messengerBag": {
      // Bag visible on the left hip from behind.
      p.rect(7, 28, 8, 10, pal.dark);
      p.rect(7, 28, 8, 2, pal.outline);
      break;
    }
    case "none":
      break;
  }
}

// ---------------------------------------------------------------------------
// Prayer outfits — mukena (white veil) and sarung + peci
// ---------------------------------------------------------------------------

/** White mukena veil, FRONT view: covers head and body, face shows. */
function drawMukenaFront(
  p: Pix,
  pal: Palette,
  spec: FrameSpec,
  blink: boolean,
): void {
  const v = pal.veil;
  const vd = pal.veilDark;
  const s = pal.skin;
  // Veil drape: head + body in one covering.
  p.rect(10, 4, 28, 41, v);
  p.rect(10, 4, 3, 41, vd); // edge shading
  p.rect(35, 4, 3, 41, vd);
  p.rect(14, 6, 2, 36, vd); // fold lines
  p.rect(32, 6, 2, 36, vd);
  // Face opening.
  p.rect(17, 11, 14, 12, s);
  p.clear(17, 11, 2, 2);
  p.clear(29, 11, 2, 2);
  p.clear(17, 21, 2, 2);
  p.clear(29, 21, 2, 2);
  // Calm face: simple eyes, closed-lip mouth.
  const d = pal.dark;
  if (blink) {
    p.rect(19, 16, 4, 1, d);
    p.rect(25, 16, 4, 1, d);
  } else {
    p.rect(19, 15, 4, 1, d);
    p.rect(25, 15, 4, 1, d);
    p.rect(20, 16, 2, 2, pal.eye);
    p.rect(26, 16, 2, 2, pal.eye);
  }
  p.rect(22, 20, 4, 1, pal.mouth);
  // Hands per prayer frame.
  if (spec.armL === "folded") {
    p.rect(20, 31, 8, 5, s); // folded at chest
    p.rect(20, 31, 8, 1, pal.skinDark);
  } else if (spec.armL === "dua") {
    p.rect(17, 27, 5, 5, s); // raised in dua
    p.rect(26, 27, 5, 5, s);
  } else {
    p.rect(13, 34, 4, 5, s); // at the sides, veiled sleeves
    p.rect(31, 34, 4, 5, s);
    p.rect(12, 30, 6, 5, v);
    p.rect(30, 30, 6, 5, v);
  }
  // Veil hem.
  p.rect(10, 43, 28, 2, vd);
}

/** White mukena veil, SIDE view (facing +x). */
function drawMukenaSide(
  p: Pix,
  pal: Palette,
  spec: FrameSpec,
  blink: boolean,
): void {
  const v = pal.veil;
  const vd = pal.veilDark;
  const s = pal.skin;
  const d = pal.dark;
  p.rect(8, 4, 29, 41, v);
  p.rect(8, 4, 3, 41, vd);
  p.rect(12, 6, 2, 36, vd);
  // Face opening on the +x side.
  p.rect(22, 11, 13, 12, s);
  p.rect(35, 16, 2, 3, s); // nose hint
  p.clear(22, 11, 2, 2);
  if (blink) {
    p.rect(26, 16, 4, 1, d);
  } else {
    p.rect(26, 15, 4, 1, d);
    p.rect(27, 16, 2, 2, pal.eye);
  }
  p.rect(31, 20, 3, 1, pal.mouth);
  // Hands.
  if (spec.armL === "folded") {
    p.rect(22, 31, 7, 5, s);
  } else if (spec.armL === "dua") {
    p.rect(24, 27, 6, 5, s);
  } else {
    p.rect(16, 34, 4, 5, s);
    p.rect(15, 30, 6, 5, v);
  }
  p.rect(8, 43, 29, 2, vd);
}

/** White mukena veil, BACK view. */
function drawMukenaBack(p: Pix, pal: Palette): void {
  const v = pal.veil;
  const vd = pal.veilDark;
  p.rect(10, 4, 28, 41, v);
  p.rect(10, 4, 4, 41, vd);
  p.rect(34, 4, 4, 41, vd);
  p.rect(16, 6, 3, 36, vd); // center fold
  p.rect(29, 6, 3, 36, vd);
  p.rect(10, 43, 28, 2, vd);
}

/** Black peci cap worn over the hair (sarungPeci outfit). */
function drawPeci(p: Pix, pal: Palette, dir: SpriteDirection): void {
  const c = pal.peci;
  if (dir === "front") {
    p.rect(17, 1, 14, 3, c);
    p.rect(15, 4, 18, 4, c);
    p.rect(15, 7, 18, 1, pal.dark);
    p.rect(18, 1, 3, 2, [60, 60, 74]); // sheen
  } else if (dir === "side") {
    p.rect(19, 1, 14, 3, c);
    p.rect(17, 4, 18, 4, c);
    p.rect(17, 7, 18, 1, pal.dark);
  } else {
    p.rect(17, 1, 14, 4, c);
    p.rect(15, 5, 18, 4, c);
    p.rect(15, 8, 18, 1, pal.dark);
  }
}

// ---------------------------------------------------------------------------
// Outline pass — 1px silhouette from exterior flood fill
// ---------------------------------------------------------------------------

function applyOutline(p: Pix, color: RGB): void {
  const { w, h, buf } = p;
  const opaque = (x: number, y: number): boolean =>
    buf[(y * w + x) * 4 + 3] > 0;
  // Flood fill exterior transparent pixels from the top-left corner.
  const ext = new Uint8Array(w * h);
  const stack: Array<[number, number]> = [[0, 0]];
  while (stack.length > 0) {
    const [x, y] = stack.pop() as [number, number];
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = y * w + x;
    if (ext[i] || opaque(x, y)) continue;
    ext[i] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const ring: Array<[number, number]> = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!ext[i] || opaque(x, y)) continue;
      if (
        (x > 0 && opaque(x - 1, y)) ||
        (x < w - 1 && opaque(x + 1, y)) ||
        (y > 0 && opaque(x, y - 1)) ||
        (y < h - 1 && opaque(x, y + 1))
      ) {
        ring.push([x, y]);
      }
    }
  }
  for (const [x, y] of ring) p.set(x, y, color, 255);
}

// ---------------------------------------------------------------------------
// View assembly
// ---------------------------------------------------------------------------

function drawFrontView(
  p: Pix,
  pal: Palette,
  preset: CharacterPreset,
  spec: FrameSpec,
  blink: boolean,
  prayer: PrayerVariant,
): void {
  if (prayer === "mukena") {
    drawMukenaFront(p, pal, spec, blink);
    if (spec.thought) drawThoughtBubble(p, pal);
    return;
  }
  const sarung = prayer === "sarungPeci";
  drawHairBackFront(p, pal, preset.hairStyle);
  drawFaceFront(p, pal);
  drawFringeFront(p, pal, preset.hairStyle);
  const cool = preset.expression === "cool";
  drawEyesFront(p, pal, blink, cool);
  drawFaceDetailsFront(p, pal, spec.mouthOpen, cool);
  drawBodyFront(p, pal, preset.outfitStyle);
  drawLegsFront(p, pal, spec.legPose, sarung ? pal.out2 : null, preset.outfitStyle);
  // In sarong the arms stay normal; folded/dua poses come from the frame.
  drawArmFront(p, pal, preset, "L", spec.armL, spec.handUp === "L");
  drawArmFront(p, pal, preset, "R", spec.armR, spec.handUp === "R");
  if (!sarung) {
    drawAccessoryFront(p, pal, preset.accessory);
  }
  if (sarung) drawPeci(p, pal, "front");
  if (spec.thought) drawThoughtBubble(p, pal);
}

function drawSideView(
  p: Pix,
  pal: Palette,
  preset: CharacterPreset,
  spec: FrameSpec,
  blink: boolean,
  prayer: PrayerVariant,
): void {
  if (prayer === "mukena") {
    drawMukenaSide(p, pal, spec, blink);
    if (spec.thought) drawThoughtBubble(p, pal);
    return;
  }
  const sarung = prayer === "sarungPeci";
  drawHairBackSide(p, pal, preset.hairStyle);
  drawFaceSide(p, pal);
  drawFringeSide(p, pal, preset.hairStyle);
  const coolSide = preset.expression === "cool";
  drawEyeSide(p, pal, blink, coolSide);
  drawFaceDetailsSide(p, pal, spec.mouthOpen, coolSide);
  drawBodySide(p, pal, preset.outfitStyle);
  drawLegsSide(p, pal, spec.legPose, sarung ? pal.out2 : null, preset.outfitStyle);
  drawArmSide(p, pal, preset, spec.armR, spec.handUp === "R");
  if (!sarung) {
    drawAccessorySide(p, pal, preset.accessory);
  }
  if (sarung) drawPeci(p, pal, "side");
  if (spec.thought) drawThoughtBubble(p, pal);
}

function drawBackView(
  p: Pix,
  pal: Palette,
  preset: CharacterPreset,
  spec: FrameSpec,
  prayer: PrayerVariant,
): void {
  if (prayer === "mukena") {
    drawMukenaBack(p, pal);
    return;
  }
  const sarung = prayer === "sarungPeci";
  drawHairBackView(p, pal, preset.hairStyle);
  drawBodyBack(p, pal, preset.outfitStyle);
  // Back legs: reuse the front leg shapes (symmetric from behind).
  drawLegsFront(p, pal, spec.legPose, sarung ? pal.out2 : null, preset.outfitStyle);
  drawArmBack(p, pal, preset, "L", spec.armL);
  drawArmBack(p, pal, preset, "R", spec.armR);
  if (!sarung) {
    drawAccessoryBack(p, pal, preset.accessory);
  }
  if (sarung) drawPeci(p, pal, "back");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render one sprite frame as an RGBA buffer (48x48). Pure function — no
 * DOM, no Three.js — so it is unit-testable.
 */
export function renderSpriteFrame(
  preset: CharacterPreset,
  dir: SpriteDirection,
  anim: ChibiAnimation,
  frame: number,
  blink = false,
  prayer: PrayerVariant = null,
): Uint8ClampedArray<ArrayBuffer> {
  const count = FRAME_COUNTS[anim];
  const f = ((frame % count) + count) % count;
  const spec = frameSpec(anim, f);
  const pal = makePalette(preset);
  const p = new Pix();
  p.oy = spec.dy;

  if (dir === "side") drawSideView(p, pal, preset, spec, blink, prayer);
  else if (dir === "back") drawBackView(p, pal, preset, spec, prayer);
  else drawFrontView(p, pal, preset, spec, blink, prayer);

  p.oy = 0;
  applyOutline(p, pal.outline);
  return p.buf;
}

function presetKey(preset: CharacterPreset): string {
  return [
    preset.agentId,
    preset.hairStyle,
    preset.hairColor,
    preset.eyeColor,
    preset.skinTone,
    preset.outfitStyle,
    preset.outfitPrimary,
    preset.outfitSecondary,
    preset.accessory,
    preset.prayerWear ?? "",
  ].join("|");
}

/**
 * LAZY frame cache: frames are rendered on first use per
 * (preset, direction, animation, frame, blink, prayer) and cached
 * afterwards. The scene only pays for the views it actually shows
 * (e.g. nobody renders the back of a typing frame until the camera
 * goes behind a working agent).
 */
const frameCache = new Map<string, Uint8ClampedArray<ArrayBuffer>>();

export function getPixelFrame(
  preset: CharacterPreset,
  dir: SpriteDirection,
  anim: ChibiAnimation,
  frame: number,
  blink = false,
  prayer: PrayerVariant = null,
): Uint8ClampedArray<ArrayBuffer> {
  const count = FRAME_COUNTS[anim];
  const f = ((frame % count) + count) % count;
  const key = [
    presetKey(preset),
    dir,
    anim,
    f,
    blink ? 1 : 0,
    prayer ?? "none",
  ].join("|");
  let buf = frameCache.get(key);
  if (!buf) {
    buf = renderSpriteFrame(preset, dir, anim, f, blink, prayer);
    frameCache.set(key, buf);
  }
  return buf;
}

/** Number of cached frames (for tests). */
export function pixelFrameCacheSize(): number {
  return frameCache.size;
}

/** Clear the frame cache (tests / preset invalidation). */
export function clearPixelSheetCache(): void {
  frameCache.clear();
}

/**
 * Resolve which animation a sprite should play right now. Praying in the
 * musola wins over everything (respectful); celebrating a just-completed
 * task wins next; otherwise a locomotion override (walking / meeting)
 * wins; otherwise the status mapping.
 *
 * Pure — unit-tested.
 */
export function resolvePixelAnimation(
  status: AgentStatus,
  animationOverride: ChibiAnimation | null,
  celebrating: boolean,
  praying = false,
): ChibiAnimation {
  if (praying) return "praying";
  if (celebrating) return "celebrate";
  if (animationOverride) return animationOverride;
  return statusToAnimation(status);
}
