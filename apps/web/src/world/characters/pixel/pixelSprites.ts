/**
 * Procedural 2D pixel-art sprite renderer for agent characters.
 *
 * The office scene renders agents as 2D pixel-art billboard sprites
 * (2.5D "Paper Mario" style) instead of rigid 3D figures: every animation
 * is a hand-drawn frame set, which reads as far less stiff than transform
 * animation on a low-poly rig.
 *
 * Design notes:
 * - Pure pixel buffers (Uint8ClampedArray) — no DOM, no Three.js here, so
 *   this module is fully unit-testable. Canvas/texture conversion lives in
 *   the components that need it (PixelAvatar, 2D previews).
 * - Grid is 28x36 px. Sprites are rendered with THREE.NearestFilter, so the
 *   individual pixels stay visible ("agak pixel pixel").
 * - Everything is palette-driven from CharacterPreset: hair style/color,
 *   skin tone, eye color, outfit colors and accessory all flow through, so
 *   admin customization keeps working unchanged.
 * - Frames are pre-rendered once per preset and cached; the scene never
 *   redraws pixels per frame (60fps-friendly).
 */
import type {
  AccessoryKind,
  CharacterPreset,
  ChibiAnimation,
  HairStyle,
  OutfitStyle,
} from "../characterTypes";
import { statusToAnimation } from "../characterTypes";
import type { AgentStatus } from "@virtual-ai-office/shared";

/** Sprite grid dimensions (pixels). */
export const SPRITE_W = 28;
export const SPRITE_H = 36;

/** All animations the sprite system can play. */
export const PIXEL_ANIMATIONS: ChibiAnimation[] = [
  "idle",
  "typing",
  "thinking",
  "walking",
  "meeting",
  "celebrate",
];

/** Frame count per animation. Walk gets 4 frames so the stride cycles. */
export const FRAME_COUNTS: Record<ChibiAnimation, number> = {
  idle: 2,
  typing: 2,
  thinking: 2,
  walking: 4,
  meeting: 2,
  celebrate: 2,
};

/** Playback speed per animation (frames per second). */
export const FRAME_FPS: Record<ChibiAnimation, number> = {
  idle: 2,
  typing: 5,
  thinking: 2,
  walking: 7,
  meeting: 3,
  celebrate: 5,
};

/** Seconds the celebrate animation plays after a task completes. */
export const CELEBRATE_SECONDS = 2.5;

/** How long the eyes stay shut during a blink, in seconds. */
export const PIXEL_BLINK_DURATION = 0.14;

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
  readonly w = SPRITE_W;
  readonly h = SPRITE_H;
  readonly buf: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(
    SPRITE_W * SPRITE_H * 4,
  );
  /** Global vertical offset applied to every draw (bob / jump). */
  oy = 0;

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
  eye: RGB;
  white: RGB;
  dark: RGB;
  blush: RGB;
  mouth: RGB;
  mouthOpen: RGB;
  out1: RGB;
  out1Dark: RGB;
  out2: RGB;
  out2Dark: RGB;
  tie: RGB;
  shoe: RGB;
  outline: RGB;
}

function makePalette(preset: CharacterPreset): Palette {
  return {
    hair: hexToRgb(preset.hairColor),
    hairDark: hexToRgb(shade(preset.hairColor, -0.3)),
    hairLight: hexToRgb(shade(preset.hairColor, 0.3)),
    skin: hexToRgb(preset.skinTone),
    eye: hexToRgb(preset.eyeColor),
    white: [255, 255, 255],
    dark: [42, 42, 58],
    blush: [255, 158, 176],
    mouth: [163, 74, 74],
    mouthOpen: [120, 40, 48],
    out1: hexToRgb(preset.outfitPrimary),
    out1Dark: hexToRgb(shade(preset.outfitPrimary, -0.25)),
    out2: hexToRgb(preset.outfitSecondary),
    out2Dark: hexToRgb(shade(preset.outfitSecondary, -0.3)),
    tie: hexToRgb(preset.outfitSecondary),
    shoe: [43, 43, 58],
    outline: [35, 35, 52],
  };
}

// ---------------------------------------------------------------------------
// Drawing — head
// ---------------------------------------------------------------------------

function drawHairBack(p: Pix, pal: Palette, style: HairStyle): void {
  const h = pal.hair;
  const hd = pal.hairDark;
  const hl = pal.hairLight;
  switch (style) {
    case "hime": // long straight + blunt sidelocks
      p.rect(5, 4, 18, 27, h);
      p.rect(5, 9, 2, 22, hd);
      p.rect(21, 9, 2, 22, hd);
      p.rect(7, 5, 2, 3, hl);
      break;
    case "bob": // neat chin-length bob
      p.rect(7, 4, 14, 3, h);
      p.rect(5, 6, 18, 15, h);
      p.rect(5, 6, 2, 15, hd);
      p.rect(21, 6, 2, 15, hd);
      p.rect(8, 5, 2, 2, hl);
      break;
    case "messy": {
      // tousled short spikes
      p.rect(6, 6, 16, 9, h);
      const spikes: Array<[number, number]> = [
        [6, 5],
        [9, 7],
        [12, 5],
        [15, 7],
        [18, 5],
      ];
      for (const [x, hh] of spikes) p.rect(x, 8 - hh, 3, hh, h);
      p.rect(7, 6, 2, 2, hl);
      break;
    }
    case "wavy": {
      // long soft waves
      p.rect(6, 4, 16, 5, h);
      for (let y = 9; y <= 29; y++) {
        const wob = Math.floor(y / 4) % 2;
        p.rect(4 + wob, y, 4, 1, h);
        p.rect(20 - wob, y, 4, 1, h);
      }
      p.rect(4, 9, 1, 21, hd);
      p.rect(23, 9, 1, 21, hd);
      break;
    }
    case "twintails":
      p.rect(7, 5, 14, 12, h);
      p.rect(1, 8, 6, 22, h); // left tail
      p.rect(21, 8, 6, 22, h); // right tail
      p.rect(1, 8, 1, 22, hd);
      p.rect(25, 8, 1, 22, hd);
      // ties (outfit secondary)
      p.rect(2, 8, 4, 2, pal.tie);
      p.rect(22, 8, 4, 2, pal.tie);
      break;
    case "spiky": {
      p.rect(6, 7, 16, 8, h);
      const spikes: Array<[number, number]> = [
        [6, 6],
        [10, 8],
        [14, 6],
        [18, 7],
      ];
      for (const [x, hh] of spikes) p.rect(x, 9 - hh, 3, hh, h);
      break;
    }
    case "ponytail":
      p.rect(6, 5, 16, 12, h);
      p.rect(19, 4, 5, 8, h); // tail upper
      p.rect(20, 12, 4, 8, h); // tail mid
      p.rect(21, 20, 3, 5, h); // tail taper
      p.rect(22, 4, 2, 20, hd); // shade
      p.rect(17, 4, 3, 3, pal.tie); // tie
      break;
    case "short": // tidy crop
      p.rect(8, 4, 12, 2, h);
      p.rect(6, 5, 16, 11, h);
      p.rect(6, 5, 2, 11, hd);
      p.rect(9, 4, 2, 1, hl);
      break;
  }
}

function drawFace(p: Pix, pal: Palette): void {
  const s = pal.skin;
  p.rect(8, 9, 12, 12, s);
  p.clear(8, 9, 1, 1);
  p.clear(19, 9, 1, 1);
  p.clear(8, 20, 1, 1);
  p.clear(19, 20, 1, 1);
  // ears
  p.rect(6, 14, 2, 2, s);
  p.rect(20, 14, 2, 2, s);
}

function drawFringe(p: Pix, pal: Palette, style: HairStyle): void {
  const h = pal.hair;
  const hd = pal.hairDark;
  switch (style) {
    case "hime":
    case "bob":
    case "twintails":
      p.rect(6, 7, 16, 3, h);
      break;
    case "messy":
      p.rect(6, 7, 16, 2, h);
      p.rect(8, 9, 2, 1, h);
      p.rect(13, 9, 3, 1, h);
      p.rect(18, 9, 2, 1, h);
      break;
    case "wavy":
      p.rect(6, 7, 16, 3, h);
      p.rect(6, 9, 3, 1, hd);
      break;
    case "spiky":
      p.rect(6, 8, 16, 2, h);
      p.rect(9, 10, 2, 1, h);
      p.rect(15, 10, 2, 1, h);
      break;
    case "ponytail":
      p.rect(6, 7, 16, 2, h);
      p.rect(6, 9, 10, 1, h); // swept
      break;
    case "short":
      p.rect(6, 8, 16, 2, h);
      break;
  }
}

function drawEyes(p: Pix, pal: Palette, blink: boolean): void {
  const d = pal.dark;
  const w = pal.white;
  const e = pal.eye;
  if (blink) {
    // closed: single lash line per eye
    p.rect(8, 14, 5, 1, d);
    p.rect(15, 14, 5, 1, d);
    return;
  }
  // upper lash
  p.rect(8, 12, 5, 1, d);
  p.rect(15, 12, 5, 1, d);
  // white
  p.rect(9, 13, 3, 4, w);
  p.rect(16, 13, 3, 4, w);
  // iris
  p.rect(9, 14, 3, 2, e);
  p.rect(16, 14, 3, 2, e);
  // highlight (outer-top) + pupil (inner)
  p.rect(9, 14, 1, 1, w);
  p.rect(18, 14, 1, 1, w);
  p.rect(11, 14, 1, 2, d);
  p.rect(16, 14, 1, 2, d);
  // lower lash
  p.rect(9, 16, 3, 1, d);
  p.rect(16, 16, 3, 1, d);
}

function drawFaceDetails(p: Pix, pal: Palette, mouthOpen: boolean): void {
  // brows
  p.rect(9, 11, 2, 1, pal.hairDark);
  p.rect(17, 11, 2, 1, pal.hairDark);
  // blush
  p.rect(7, 17, 2, 1, pal.blush);
  p.rect(19, 17, 2, 1, pal.blush);
  // mouth
  if (mouthOpen) p.rect(13, 17, 2, 2, pal.mouthOpen);
  else p.rect(13, 18, 2, 1, pal.mouth);
}

// ---------------------------------------------------------------------------
// Drawing — body
// ---------------------------------------------------------------------------

function drawBody(p: Pix, pal: Palette, outfit: OutfitStyle): void {
  const o1 = pal.out1;
  const o2 = pal.out2;
  const o2d = pal.out2Dark;
  const s = pal.skin;
  // neck
  p.rect(12, 21, 4, 2, s);
  // torso base (cozy = oversized)
  const wide = outfit === "cozy";
  p.rect(wide ? 8 : 9, 22, wide ? 12 : 10, 7, o1);
  switch (outfit) {
    case "sweater":
      p.rect(8, 26, 12, 5, o2); // skirt
      break;
    case "vest":
      p.rect(9, 22, 3, 6, o2); // vest panels
      p.rect(16, 22, 3, 6, o2);
      p.rect(13, 23, 2, 5, o2d); // tie
      break;
    case "hoodie":
      p.rect(10, 21, 8, 2, o2); // hood behind neck
      p.rect(11, 26, 6, 3, o2); // pocket
      break;
    case "cozy":
      break;
    case "jacket":
      p.rect(9, 22, 2, 7, o2); // open jacket panels
      p.rect(17, 22, 2, 7, o2);
      break;
    case "shirtTie":
      p.rect(13, 23, 2, 6, o2); // tie
      p.rect(12, 22, 1, 2, o2d); // collar
      p.rect(15, 22, 1, 2, o2d);
      break;
    case "workJacket":
      p.rect(9, 28, 10, 1, o2); // belt
      p.rect(11, 22, 2, 2, o2); // collar
      p.rect(15, 22, 2, 2, o2);
      break;
    case "uniform":
      p.rect(8, 22, 3, 1, o2); // epaulets
      p.rect(17, 22, 3, 1, o2);
      p.rect(13, 24, 2, 1, o2); // buttons
      p.rect(13, 26, 2, 1, o2);
      break;
  }
}

type LegPose = "neutral" | "stepL" | "stepR" | "together";

function drawLegs(
  p: Pix,
  pal: Palette,
  pose: LegPose,
  legColor: RGB,
): void {
  const sh = pal.shoe;
  let ll = 10;
  let rl = 15;
  if (pose === "stepL") {
    ll = 8;
    rl = 15;
  } else if (pose === "stepR") {
    ll = 10;
    rl = 16;
  } else if (pose === "together") {
    ll = 11;
    rl = 14;
  }
  const top = 29;
  p.rect(ll, top, 3, 5, legColor); // y29..33
  p.rect(rl, top, 3, 5, legColor);
  p.rect(ll - 1, 34, 5, 2, sh); // shoes y34..35
  p.rect(rl - 1, 34, 5, 2, sh);
}

type ArmPose = "down" | "swing" | "typing" | "chin" | "up";

function drawArm(
  p: Pix,
  pal: Palette,
  side: "L" | "R",
  pose: ArmPose,
  handUp: boolean,
): void {
  const x0 = side === "L" ? 7 : 19;
  const o1 = pal.out1;
  const s = pal.skin;
  switch (pose) {
    case "down":
      p.rect(x0, 23, 2, 5, o1);
      p.rect(x0, 28, 2, 2, s);
      break;
    case "swing": // walk arm swing: hand 1px lower
      p.rect(x0, 23, 2, 5, o1);
      p.rect(x0, 29, 2, 2, s);
      break;
    case "typing": {
      // forearms angled inward, hands alternate height
      const ix = side === "L" ? 8 : 18;
      p.rect(x0, 23, 2, 3, o1);
      p.rect(ix, 26, 2, 3, o1);
      p.rect(ix, handUp ? 27 : 28, 2, 2, s);
      break;
    }
    case "chin": {
      // hand raised to chin (thinking)
      p.rect(x0, 23, 2, 4, o1);
      p.rect(x0, 20, 2, 3, o1);
      p.rect(x0 - 1, 18, 3, 2, s);
      break;
    }
    case "up":
      // arm raised high (celebrate / meeting gesture)
      p.rect(x0, 17, 2, 6, o1);
      p.rect(x0, 15, 2, 2, s);
      break;
  }
}

// ---------------------------------------------------------------------------
// Drawing — accessories
// ---------------------------------------------------------------------------

function drawAccessory(p: Pix, pal: Palette, acc: AccessoryKind): void {
  const d = pal.dark;
  switch (acc) {
    case "ribbon": {
      // bow on the upper-right of the hair
      const c = pal.out2;
      const cd = pal.out2Dark;
      p.rect(16, 4, 2, 2, c);
      p.rect(20, 4, 2, 2, c);
      p.rect(16, 7, 1, 2, c);
      p.rect(21, 7, 1, 2, c);
      p.rect(18, 4, 2, 3, cd); // knot
      break;
    }
    case "roundGlasses":
      // round rims around each eye + bridge
      for (const x0 of [8, 15]) {
        p.rect(x0, 12, 5, 1, d);
        p.rect(x0, 17, 5, 1, d);
        p.rect(x0, 12, 1, 6, d);
        p.rect(x0 + 4, 12, 1, 6, d);
      }
      p.rect(13, 14, 2, 1, d);
      break;
    case "headphones":
      // band + ear cups
      p.rect(5, 2, 18, 2, d);
      p.rect(5, 4, 2, 2, d);
      p.rect(21, 4, 2, 2, d);
      p.rect(4, 11, 4, 7, d);
      p.rect(20, 11, 4, 7, d);
      p.rect(5, 12, 2, 2, pal.out2);
      p.rect(21, 12, 2, 2, pal.out2);
      break;
    case "beret": {
      // tilted beret
      const c = pal.out2;
      p.rect(9, 3, 11, 4, c);
      p.rect(15, 2, 5, 2, c);
      p.rect(17, 1, 1, 1, pal.out2Dark);
      break;
    }
    case "starPin": {
      // little star on the left of the hair
      const g: RGB = [255, 210, 63];
      p.rect(6, 8, 3, 1, g);
      p.rect(7, 7, 1, 3, g);
      break;
    }
    case "rectGlasses":
      for (const x0 of [8, 15]) {
        p.rect(x0, 13, 5, 1, d);
        p.rect(x0, 16, 5, 1, d);
        p.rect(x0, 13, 1, 4, d);
        p.rect(x0 + 4, 13, 1, 4, d);
      }
      p.rect(13, 14, 2, 1, d);
      break;
    case "cap": {
      // work cap: dome + brim
      const c = pal.out2;
      p.rect(9, 2, 10, 2, c);
      p.rect(7, 4, 14, 3, c);
      p.rect(7, 7, 16, 1, c); // brim
      p.rect(13, 1, 2, 1, pal.out2Dark); // button
      break;
    }
    case "headsetMic":
      // thin band + mic boom to the mouth
      p.rect(6, 3, 16, 1, d);
      p.rect(20, 14, 1, 4, d);
      p.rect(17, 17, 3, 1, d);
      p.rect(15, 16, 2, 2, d);
      break;
    case "none":
      break;
  }
}

function drawThoughtBubble(p: Pix, pal: Palette): void {
  const w = pal.white;
  p.rect(24, 8, 1, 1, w);
  p.rect(25, 6, 1, 1, w);
  p.rect(22, 1, 5, 1, w);
  p.rect(22, 4, 5, 1, w);
  p.rect(22, 1, 1, 4, w);
  p.rect(26, 1, 1, 4, w);
}

// ---------------------------------------------------------------------------
// Frame specs
// ---------------------------------------------------------------------------

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
    case "idle":
      return {
        dy: frame === 1 ? 1 : 0,
        legPose: "neutral",
        armL: "down",
        armR: "down",
        handUp: null,
        thought: false,
        mouthOpen: false,
      };
    case "typing":
      return {
        dy: 0,
        legPose: "neutral",
        armL: "typing",
        armR: "typing",
        handUp: frame === 0 ? "L" : "R",
        thought: false,
        mouthOpen: false,
      };
    case "thinking":
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
            armR: "chin",
            handUp: null,
            thought: true,
            mouthOpen: false,
          };
    case "walking": {
      const poses: LegPose[] = ["stepL", "together", "stepR", "together"];
      return {
        dy: frame % 2 === 1 ? 1 : 0,
        legPose: poses[frame],
        armL: frame === 0 ? "swing" : "down",
        armR: frame === 2 ? "swing" : "down",
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
            mouthOpen: false,
          };
    case "celebrate":
      return frame === 0
        ? {
            dy: -2,
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Render one sprite frame as an RGBA buffer (28x36). Pure function — no
 * DOM, no Three.js — so it is unit-testable.
 */
export function renderSpriteFrame(
  preset: CharacterPreset,
  anim: ChibiAnimation,
  frame: number,
  blink = false,
): Uint8ClampedArray<ArrayBuffer> {
  const count = FRAME_COUNTS[anim];
  const f = ((frame % count) + count) % count;
  const spec = frameSpec(anim, f);
  const pal = makePalette(preset);
  const p = new Pix();
  p.oy = spec.dy;

  drawHairBack(p, pal, preset.hairStyle);
  drawFace(p, pal);
  drawFringe(p, pal, preset.hairStyle);
  drawEyes(p, pal, blink);
  drawFaceDetails(p, pal, spec.mouthOpen);
  drawBody(p, pal, preset.outfitStyle);
  // Legs: jacket/workJacket wear pants; everything else is bare legs.
  const legColor =
    preset.outfitStyle === "jacket" || preset.outfitStyle === "workJacket"
      ? pal.out2
      : pal.skin;
  drawLegs(p, pal, spec.legPose, legColor);
  drawArm(p, pal, "L", spec.armL, spec.handUp === "L");
  drawArm(p, pal, "R", spec.armR, spec.handUp === "R");
  drawAccessory(p, pal, preset.accessory);
  if (spec.thought) drawThoughtBubble(p, pal);

  p.oy = 0;
  applyOutline(p, pal.outline);
  return p.buf;
}

/** A pre-rendered frame set for one preset. */
export interface PixelSheet {
  get(
    anim: ChibiAnimation,
    frame: number,
    blink: boolean,
  ): Uint8ClampedArray<ArrayBuffer>;
}

const sheetCache = new Map<string, PixelSheet>();

function sheetKey(preset: CharacterPreset): string {
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
  ].join("|");
}

/**
 * Get (or build + cache) the full pre-rendered frame set for a preset:
 * every animation x every frame x open/blinked eyes.
 */
export function getPixelSheet(preset: CharacterPreset): PixelSheet {
  const key = sheetKey(preset);
  const hit = sheetCache.get(key);
  if (hit) return hit;
  const frames = new Map<string, Uint8ClampedArray<ArrayBuffer>>();
  for (const anim of PIXEL_ANIMATIONS) {
    for (let f = 0; f < FRAME_COUNTS[anim]; f++) {
      frames.set(`${anim}:${f}:0`, renderSpriteFrame(preset, anim, f, false));
      frames.set(`${anim}:${f}:1`, renderSpriteFrame(preset, anim, f, true));
    }
  }
  const sheet: PixelSheet = {
    get: (anim, frame, blink) => {
      const count = FRAME_COUNTS[anim];
      const f = ((frame % count) + count) % count;
      return frames.get(`${anim}:${f}:${blink ? 1 : 0}`) as Uint8ClampedArray<ArrayBuffer>;
    },
  };
  sheetCache.set(key, sheet);
  return sheet;
}

/** Clear the sheet cache (tests / preset invalidation). */
export function clearPixelSheetCache(): void {
  sheetCache.clear();
}

/**
 * Resolve which animation a sprite should play right now. Celebrating a
 * just-completed task wins; otherwise a locomotion override (walking /
 * meeting) wins; otherwise the status mapping.
 *
 * Pure — unit-tested.
 */
export function resolvePixelAnimation(
  status: AgentStatus,
  animationOverride: ChibiAnimation | null,
  celebrating: boolean,
): ChibiAnimation {
  if (celebrating) return "celebrate";
  if (animationOverride) return animationOverride;
  return statusToAnimation(status);
}
