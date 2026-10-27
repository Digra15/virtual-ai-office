/**
 * Smooth 2D vector-style character renderer for agent avatars.
 *
 * Replaces the chunky 48x48 pixel-art look with clean anime/chibi 2D art
 * (the style of the user's reference image): smooth bezier hair spikes,
 * clean face lines, soft clothing shading — rasterized at 192x192 with
 * 2x supersampled anti-aliasing by the pure-software VCtx rasterizer
 * (./raster.ts), so it runs in unit tests (no DOM canvas) and in the
 * browser identically.
 *
 * Public API mirrors pixel/pixelSprites.ts:
 *   renderVectorFrame(preset, dir, anim, frame, blink, prayer) -> RGBA buffer
 *   getVectorFrame(...)  — lazy per-key cache
 *   vectorFrameCacheSize(), clearVectorSheetCache()
 *   VECTOR_W / VECTOR_H = 192
 * Animation timing (FRAME_COUNTS / FRAME_FPS / CELEBRATE_SECONDS /
 * PIXEL_BLINK_DURATION / resolvePixelAnimation) is re-exported from the
 * pixel module — the frame model is renderer-agnostic.
 *
 * Character rig: a parametric chibi (~2.8 heads tall, big head like the
 * reference). Each (anim, frame) resolves to a PoseSpec (joint angles,
 * bob, lean, mouth); limbs are drawn as tapered capsules rotated at
 * shoulder/hip/elbow/knee pivots. Hair (9 styles), outfits (8 styles),
 * accessories (10 kinds), expressions (cool/neutral) and prayer outfits
 * (mukena / sarung+peci) are all vector-drawn per direction.
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
import { VCtx, vGradient, vShade, type Paint } from "./raster";
import {
  CELEBRATE_SECONDS,
  FRAME_COUNTS,
  FRAME_FPS,
  PIXEL_ANIMATIONS,
  PIXEL_BLINK_DURATION,
  resolvePixelAnimation,
  type PrayerVariant,
} from "../pixel/pixelSprites";

export {
  CELEBRATE_SECONDS,
  FRAME_COUNTS,
  FRAME_FPS,
  PIXEL_ANIMATIONS,
  PIXEL_BLINK_DURATION,
  resolvePixelAnimation,
};
export type { PrayerVariant };

/** Vector sprite grid: 192x192 RGBA, LinearFilter in the scene. */
export const VECTOR_W = 192;
export const VECTOR_H = 192;

/** All animations (same set as the pixel renderer). */
export const VECTOR_ANIMATIONS = PIXEL_ANIMATIONS;

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

interface VPal {
  hair: string;
  hairDark: string;
  hairLight: string;
  skin: string;
  skinDark: string;
  skinDeep: string;
  eye: string;
  white: string;
  outline: string;
  mouth: string;
  out1: string;
  out1Dark: string;
  out1Light: string;
  out2: string;
  out2Dark: string;
  trouser: string;
  trouserDark: string;
  shoe: string;
  shoeDark: string;
  sole: string;
  veil: string;
  veilDark: string;
  peci: string;
}

function makePalette(p: CharacterPreset): VPal {
  return {
    hair: p.hairColor,
    hairDark: vShade(p.hairColor, -0.35),
    hairLight: vShade(p.hairColor, 0.45),
    skin: p.skinTone,
    skinDark: vShade(p.skinTone, -0.16),
    skinDeep: vShade(p.skinTone, -0.3),
    eye: p.eyeColor,
    white: "#ffffff",
    outline: "#2e2a33",
    mouth: "#a14e4e",
    out1: p.outfitPrimary,
    out1Dark: vShade(p.outfitPrimary, -0.3),
    out1Light: vShade(p.outfitPrimary, 0.28),
    out2: p.outfitSecondary,
    out2Dark: vShade(p.outfitSecondary, -0.32),
    trouser: vShade(p.outfitPrimary, -0.55),
    trouserDark: vShade(p.outfitPrimary, -0.72),
    shoe: "#33333f",
    shoeDark: "#23232c",
    sole: "#f2f2f5",
    veil: "#f7f7fb",
    veilDark: "#d9dbe6",
    peci: "#17171d",
  };
}

// ---------------------------------------------------------------------------
// Pose model
// ---------------------------------------------------------------------------

type MouthKind = "smile" | "smirk" | "open" | "flat";

interface PoseSpec {
  dy: number;
  lean: number; // torso+head lean forward (radians), pivoting at hips
  headTilt: number;
  headDy: number;
  armL: [number, number]; // [shoulder, elbow] — see armPoints
  armR: [number, number];
  legL: [number, number]; // [hip, knee]
  legR: [number, number];
  mouth: MouthKind;
}

/**
 * Joint angles: 0 = limb points straight down. Shoulder/hip angle a1 and
 * elbow/knee bend a2; the caller signs a1 (negative = character's left
 * side swings outward to viewer-left).
 */
function poseFor(anim: ChibiAnimation, frame: number): PoseSpec {
  const f = frame;
  switch (anim) {
    case "idle": {
      const bob = [0, -1.5, 0, -1.5][f % 4];
      return {
        dy: bob, lean: 0, headTilt: 0, headDy: bob * 0.4,
        armL: [-0.14, -0.18], armR: [0.14, 0.18],
        legL: [0, 0], legR: [0, 0],
        mouth: "smile",
      };
    }
    case "typing":
      return {
        dy: 0, lean: 0.06, headTilt: 0, headDy: 1,
        // forearms bent up/in — hands hover over an imaginary keyboard
        armL: [-0.35, -1.5 + (f % 2) * 0.12], armR: [0.35, 1.5 - (f % 2) * 0.12],
        legL: [0, 0], legR: [0, 0],
        mouth: "flat",
      };
    case "thinking": {
      const sway = [0, 0.06, 0, -0.06][f % 4];
      return {
        dy: 0, lean: 0, headTilt: 0.1 + sway, headDy: 0,
        // right hand to chin
        armL: [-0.14, -0.25], armR: [0.45, 2.25],
        legL: [0, 0], legR: [0, 0],
        mouth: "flat",
      };
    }
    case "walking": {
      // 8-frame stride
      const ph = (f / 8) * Math.PI * 2;
      const swing = Math.sin(ph);
      const lift = Math.max(0, Math.sin(ph + Math.PI / 2));
      return {
        dy: -2.5 * Math.abs(Math.cos(ph)),
        lean: 0.05, headTilt: 0, headDy: 0,
        armL: [-0.5 * swing, -0.3], armR: [0.5 * swing, 0.3],
        legL: [0.55 * swing, swing > 0 ? -0.5 * lift : 0.1],
        legR: [-0.55 * swing, swing < 0 ? -0.5 * lift : 0.1],
        mouth: "smile",
      };
    }
    case "meeting": {
      const g = f % 2 === 0 ? 0.5 : 0.9; // gesturing right hand
      return {
        dy: [0, -1][f % 2], lean: 0, headTilt: 0, headDy: 0,
        armL: [-0.2, -0.3], armR: [g, 1.1],
        legL: [0, 0], legR: [0, 0],
        mouth: f % 2 === 0 ? "smile" : "open",
      };
    }
    case "celebrate":
      return {
        dy: f % 2 === 0 ? -9 : -4, lean: -0.06, headTilt: 0, headDy: -2,
        armL: [-2.5, -0.25], armR: [2.5, 0.25],
        legL: [-0.25, 0.35], legR: [0.25, -0.35],
        mouth: "open",
      };
    case "praying": {
      // 0 qiyam (hands folded low) → 1 hands at chest → 2 ruku (bow) → 3 dua (hands raised)
      if (f === 2)
        return {
          dy: 6, lean: 1.05, headTilt: 0.3, headDy: 0,
          armL: [-0.15, -0.2], armR: [0.15, 0.2],
          legL: [0, 0], legR: [0, 0],
          mouth: "flat",
        };
      if (f === 3)
        return {
          dy: 0, lean: -0.08, headTilt: -0.12, headDy: -3,
          armL: [-1.15, -0.5], armR: [1.15, 0.5],
          legL: [0, 0], legR: [0, 0],
          mouth: "flat",
        };
      const chest = f === 1;
      return {
        dy: 0, lean: 0, headTilt: 0, headDy: 0,
        armL: chest ? [-0.5, -1.15] : [-0.42, -0.95],
        armR: chest ? [0.5, 1.15] : [0.42, 0.95],
        legL: [0, 0], legR: [0, 0],
        mouth: "flat",
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Small drawing helpers
// ---------------------------------------------------------------------------

const OUT = "#2e2a33";

/** Filled shape + outline stroke. */
function shape(v: VCtx, paint: Paint, outlineW = 3): void {
  v.fill(paint);
  if (outlineW > 0) {
    const lw = v.lineWidth;
    v.lineWidth = outlineW;
    v.stroke(OUT);
    v.lineWidth = lw;
  }
}

/** Limb segment points from joint angles (0 = straight down). */
function limbPoints(
  sx: number, sy: number,
  a1: number, a2: number,
  l1: number, l2: number,
): { ex: number; ey: number; hx: number; hy: number } {
  const ex = sx + Math.sin(a1) * l1;
  const ey = sy + Math.cos(a1) * l1;
  const a = a1 + a2;
  return { ex, ey, hx: ex + Math.sin(a) * l2, hy: ey + Math.cos(a) * l2 };
}

/** Star polygon points. */
function starPts(cx: number, cy: number, rO: number, rI: number, n = 5, rot = -Math.PI / 2): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rO : rI;
    const t = rot + (i / (n * 2)) * Math.PI * 2;
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Face
// ---------------------------------------------------------------------------

function drawEyesFront(
  v: VCtx, pal: VPal,
  cool: boolean, blink: boolean,
  eyeDY = 0,
): void {
  const y = 58 + eyeDY;
  for (const cx of [79, 113]) {
    if (blink) {
      // closed: curved lash line
      v.beginPath();
      v.moveTo(cx - 9, y + 1);
      v.quadraticCurveTo(cx, y + 5, cx + 9, y + 1);
      const lw = v.lineWidth; v.lineWidth = 3.4; v.stroke(pal.outline); v.lineWidth = lw;
      continue;
    }
    if (cool) {
      // half-lidded: shorter eye + heavy angled upper lid
      v.beginPath(); v.ellipse(cx, y + 2, 9.5, 7, 0); v.fill("#ffffff");
      v.beginPath(); v.ellipse(cx, y + 3.5, 6, 5.4, 0); v.fill(pal.eye);
      v.beginPath(); v.circle(cx, y + 3.5, 3); v.fill(pal.outline);
      v.beginPath(); v.circle(cx - 2, y + 1.5, 1.7); v.fill("#ffffff");
      // lid: skin-tinted cover over the top + thick lash line
      v.beginPath();
      v.moveTo(cx - 10.5, y - 8);
      v.quadraticCurveTo(cx, y - 11, cx + 10.5, y - 8);
      v.lineTo(cx + 10.5, y - 2);
      v.quadraticCurveTo(cx, y - 5, cx - 10.5, y - 2);
      v.closePath();
      v.fill(pal.skin);
      v.beginPath();
      v.moveTo(cx - 10, y - 4);
      v.quadraticCurveTo(cx, y - 7.5, cx + 10, y - 4);
      const lw = v.lineWidth; v.lineWidth = 4; v.stroke(pal.outline); v.lineWidth = lw;
    } else {
      v.beginPath(); v.ellipse(cx, y, 9.5, 11, 0); v.fill("#ffffff");
      v.beginPath(); v.circle(cx, y + 1.5, 6); v.fill(pal.eye);
      v.beginPath(); v.circle(cx, y + 1.5, 3.1); v.fill(pal.outline);
      v.beginPath(); v.circle(cx - 2.2, y - 1, 2); v.fill("#ffffff");
      v.beginPath();
      v.moveTo(cx - 10.5, y - 6);
      v.quadraticCurveTo(cx, y - 11.5, cx + 10.5, y - 6);
      const lw = v.lineWidth; v.lineWidth = 3.6; v.stroke(pal.outline); v.lineWidth = lw;
    }
  }
}

function drawBrowsFront(v: VCtx, pal: VPal, cool: boolean, dy = 0): void {
  const y = 44 + dy;
  if (cool) {
    // thick, angled down toward the nose — confident
    v.limb(66, y - 2, 90, y + 5, 5.5, pal.outline);
    v.limb(126, y - 2, 102, y + 5, 5.5, pal.outline);
  } else {
    v.limb(68, y, 90, y - 3, 4.5, pal.outline);
    v.limb(124, y, 102, y - 3, 4.5, pal.outline);
  }
}

function drawMouthFront(v: VCtx, pal: VPal, kind: MouthKind, dy = 0): void {
  const y = 76 + dy;
  const lw = v.lineWidth;
  if (kind === "smile") {
    v.beginPath();
    v.moveTo(88, y - 1); v.quadraticCurveTo(96, y + 6, 104, y - 1);
    v.lineWidth = 3; v.stroke(pal.mouth); v.lineWidth = lw;
  } else if (kind === "smirk") {
    v.beginPath();
    v.moveTo(90, y + 1); v.quadraticCurveTo(99, y + 4, 106, y - 2);
    v.lineWidth = 3; v.stroke(pal.mouth); v.lineWidth = lw;
  } else if (kind === "open") {
    v.beginPath(); v.ellipse(96, y + 2, 5.5, 7, 0); v.fill("#7c3333");
    v.beginPath(); v.ellipse(96, y + 5.5, 3.4, 3.4, 0); v.fill("#d98a8a");
  } else {
    v.limb(90, y + 1, 102, y + 1, 2.8, pal.mouth);
  }
}

// ---------------------------------------------------------------------------
// Hair — front view
// ---------------------------------------------------------------------------

/** Jagged spike ring around the head; tips stay sharp (no smoothing). */
function spikeRing(
  cx: number, cy: number,
  spikes: { a0: number; a1: number; n: number; rO: number; rI: number; jitter?: number },
  squashY = 1,
): [number, number][] {
  const pts: [number, number][] = [];
  const { a0, a1, n, rO, rI } = spikes;
  for (let i = 0; i <= n * 2; i++) {
    const t = a0 + ((a1 - a0) * i) / (n * 2);
    const outer = i % 2 === 0;
    let r = outer ? rO : rI;
    if (spikes.jitter) r += Math.sin(i * 12.9898) * spikes.jitter;
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t) * squashY]);
  }
  return pts;
}

function hairOutline(v: VCtx, pal: VPal, pts: [number, number][], smooth: boolean): void {
  v.beginPath();
  if (smooth) v.smoothClosed(pts);
  else {
    v.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) v.lineTo(pts[i][0], pts[i][1]);
    v.closePath();
  }
  v.fill(vGradient(96, 0, 96, 90, [
    { offset: 0, color: pal.hairLight },
    { offset: 0.45, color: pal.hair },
    { offset: 1, color: pal.hairDark },
  ]));
  const lw = v.lineWidth; v.lineWidth = 3.2; v.stroke(OUT); v.lineWidth = lw;
}

function drawHairFront(v: VCtx, style: HairStyle, pal: VPal): void {
  const cx = 96;
  switch (style) {
    case "wildSpikes": {
      // Voluminous wild spikes — the reference look. Big jagged mass.
      const pts = spikeRing(cx, 42, { a0: Math.PI * 0.98, a1: Math.PI * 2.02, n: 13, rO: 58, rI: 38, jitter: 5 }, 0.9);
      // extend side coverage down past the ears
      pts.push([146, 62], [138, 80], [126, 74]);
      pts.unshift([46, 62], [54, 80], [66, 74]);
      hairOutline(v, pal, pts, false);
      // spiky bangs: separate triangular spikes with forehead showing between
      for (let i = 0; i < 7; i++) {
        const x0 = 64 + i * 9.5;
        const tipY = 44 + (i % 2) * 6;
        v.beginPath();
        v.moveTo(x0, 30); v.lineTo(x0 + 9.5, 30); v.lineTo(x0 + 4.75, tipY);
        v.closePath();
        v.fill(pal.hair);
      }
      // shine streaks
      v.globalAlpha = 0.5;
      v.beginPath();
      v.moveTo(70, 22); v.quadraticCurveTo(84, 10, 100, 16); v.quadraticCurveTo(86, 22, 70, 22);
      v.closePath(); v.fill(pal.hairLight);
      v.globalAlpha = 1;
      break;
    }
    case "spiky": {
      const pts = spikeRing(cx, 48, { a0: Math.PI * 1.02, a1: Math.PI * 1.98, n: 9, rO: 52, rI: 36, jitter: 3 }, 0.9);
      hairOutline(v, pal, pts, false);
      v.beginPath();
      v.moveTo(64, 42);
      for (let i = 0; i <= 8; i++) v.lineTo(64 + (i / 8) * 64, i % 2 === 0 ? 50 : 40);
      v.lineTo(128, 42); v.lineTo(124, 30); v.lineTo(68, 30); v.closePath();
      v.fill(pal.hair);
      break;
    }
    case "messy": {
      const pts = spikeRing(cx, 50, { a0: Math.PI * 1.0, a1: Math.PI * 2.0, n: 11, rO: 46, rI: 35, jitter: 4 }, 0.88);
      hairOutline(v, pal, pts, false);
      v.beginPath();
      v.moveTo(66, 44);
      for (let i = 0; i <= 8; i++) v.lineTo(66 + (i / 8) * 60, i % 2 === 0 ? 50 : 42);
      v.lineTo(126, 44); v.lineTo(122, 34); v.lineTo(70, 34); v.closePath();
      v.fill(pal.hair);
      break;
    }
    case "hime": {
      // long straight panels + blunt bangs + sidelocks
      v.beginPath();
      v.smoothClosed([[58, 60], [56, 130], [66, 138], [76, 128], [74, 62]]);
      v.fill(pal.hair); const lw0 = v.lineWidth; v.lineWidth = 3; v.stroke(OUT); v.lineWidth = lw0;
      v.beginPath();
      v.smoothClosed([[134, 60], [136, 130], [126, 138], [116, 128], [118, 62]]);
      v.fill(pal.hair); v.lineWidth = 3; v.stroke(OUT); v.lineWidth = lw0;
      hairOutline(v, pal, [[60, 52], [64, 20], [96, 8], [128, 20], [132, 52], [118, 44], [96, 40], [74, 44]], true);
      // straight bangs
      v.beginPath();
      v.moveTo(64, 38);
      for (let i = 0; i <= 12; i++) v.lineTo(64 + (i / 12) * 64, 50 + (i % 2 === 0 ? 2 : -1));
      v.lineTo(128, 38); v.lineTo(128, 28); v.lineTo(64, 28); v.closePath();
      v.fill(pal.hair);
      // blunt sidelocks framing the face
      for (const [x0, x1] of [[58, 72], [134, 120]] as [number, number][]) {
        v.beginPath();
        v.roundRect(Math.min(x0, x1), 52, 14, 44, 6);
        v.fill(pal.hair); v.lineWidth = 2.6; v.stroke(OUT); v.lineWidth = lw0;
      }
      break;
    }
    case "wavy": {
      const wave = (x0: number, flip: number): [number, number][] => {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 16; i++) {
          const y = 50 + (i / 16) * 92;
          pts.push([x0 + Math.sin(i * 1.4) * 9 * flip, y]);
        }
        return pts;
      };
      const L = wave(58, 1), R = wave(134, -1).reverse();
      hairOutline(v, pal, [...L, ...R], true);
      hairOutline(v, pal, [[62, 54], [66, 22], [96, 10], [126, 22], [130, 54], [112, 46], [80, 46]], true);
      v.beginPath();
      v.moveTo(66, 40);
      for (let i = 0; i <= 10; i++) v.lineTo(66 + (i / 10) * 60, 50 + Math.sin(i * 2.2) * 4);
      v.lineTo(126, 40); v.lineTo(122, 30); v.lineTo(70, 30); v.closePath();
      v.fill(pal.hair);
      break;
    }
    case "bob": {
      hairOutline(v, pal, [[58, 66], [58, 40], [66, 20], [96, 10], [126, 20], [134, 40], [134, 66], [126, 84], [112, 78], [80, 78], [66, 84]], true);
      v.beginPath();
      v.moveTo(66, 40);
      for (let i = 0; i <= 10; i++) v.lineTo(66 + (i / 10) * 60, 50 + (i % 2 === 0 ? 1.5 : -1));
      v.lineTo(126, 40); v.lineTo(122, 30); v.lineTo(70, 30); v.closePath();
      v.fill(pal.hair);
      break;
    }
    case "twintails": {
      // tails behind
      for (const s of [-1, 1]) {
        v.save(); v.translate(96 + s * 40, 56);
        v.beginPath();
        v.smoothClosed([[0, -6], [s * 26, 10], [s * 34, 52], [s * 22, 92], [s * 6, 96], [s * -2, 60], [s * -8, 20]]);
        v.fill(pal.hair); const lw = v.lineWidth; v.lineWidth = 3; v.stroke(OUT); v.lineWidth = lw;
        // tie
        v.beginPath(); v.circle(s * 2, -2, 6); v.fill(pal.out2);
        v.restore();
      }
      hairOutline(v, pal, [[64, 50], [68, 22], [96, 12], [124, 22], [128, 50], [112, 44], [80, 44]], true);
      v.beginPath();
      v.moveTo(68, 40);
      for (let i = 0; i <= 8; i++) v.lineTo(68 + (i / 8) * 56, 50 + (i % 2 === 0 ? 2 : -2));
      v.lineTo(124, 40); v.lineTo(120, 30); v.lineTo(72, 30); v.closePath();
      v.fill(pal.hair);
      break;
    }
    case "ponytail": {
      v.save(); v.translate(132, 34);
      v.beginPath();
      v.smoothClosed([[0, -8], [26, 6], [34, 44], [24, 84], [8, 88], [-2, 52], [-8, 16]]);
      v.fill(pal.hair); const lw = v.lineWidth; v.lineWidth = 3; v.stroke(OUT); v.lineWidth = lw;
      v.beginPath(); v.circle(2, -4, 6.5); v.fill(pal.out2);
      v.restore();
      hairOutline(v, pal, [[62, 52], [66, 22], [96, 10], [126, 22], [130, 52], [112, 44], [80, 44]], true);
      v.beginPath();
      v.moveTo(66, 40);
      for (let i = 0; i <= 10; i++) v.lineTo(66 + (i / 10) * 60, 50 + (i % 2 === 0 ? 1.5 : -1));
      v.lineTo(126, 40); v.lineTo(122, 30); v.lineTo(70, 30); v.closePath();
      v.fill(pal.hair);
      break;
    }
    case "short": {
      hairOutline(v, pal, [[62, 58], [60, 36], [70, 18], [96, 10], [122, 18], [132, 36], [130, 58], [124, 48], [112, 52], [96, 46], [80, 52], [68, 48]], true);
      // neat sideburns
      v.beginPath(); v.roundRect(60, 52, 9, 18, 4); v.fill(pal.hair);
      v.beginPath(); v.roundRect(123, 52, 9, 18, 4); v.fill(pal.hair);
      // shine
      v.globalAlpha = 0.55;
      v.beginPath(); v.ellipse(82, 26, 16, 7, -0.4); v.fill(pal.hairLight);
      v.globalAlpha = 1;
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Outfits — front view
// ---------------------------------------------------------------------------

function drawTorsoBase(v: VCtx, fill: Paint): void {
  v.beginPath();
  v.roundRect(64, 94, 64, 40, 15);
  shape(v, fill, 3);
}

function drawOutfitFront(v: VCtx, style: OutfitStyle, pal: VPal): void {
  switch (style) {
    case "streetTee": {
      // white tee with collar + fold lines
      drawTorsoBase(v, vGradient(64, 94, 64, 134, [
        { offset: 0, color: pal.out1Light }, { offset: 1, color: pal.out1 },
      ]));
      // sleeves
      for (const s of [-1, 1]) {
        v.beginPath(); v.roundRect(s < 0 ? 52 : 120, 96, 20, 26, 8);
        shape(v, pal.out1, 2.6);
      }
      // collar
      v.beginPath(); v.ellipse(96, 96, 13, 6, 0);
      const lw = v.lineWidth; v.lineWidth = 2.6; v.stroke(pal.out1Dark); v.lineWidth = lw;
      // fold lines
      v.lineWidth = 2;
      v.beginPath(); v.moveTo(78, 112); v.quadraticCurveTo(88, 118, 84, 128); v.stroke(vShade(pal.out1, -0.18));
      v.beginPath(); v.moveTo(114, 110); v.quadraticCurveTo(106, 118, 110, 128); v.stroke(vShade(pal.out1, -0.18));
      v.lineWidth = lw;
      break;
    }
    case "blazer": {
      // blouse
      drawTorsoBase(v, "#f5f0e6");
      // blazer panels with V opening
      for (const s of [-1, 1]) {
        v.beginPath();
        v.moveTo(96 + s * 4, 98);
        v.lineTo(96 + s * 30, 98);
        v.lineTo(96 + s * 26, 134);
        v.lineTo(96 + s * 6, 134);
        v.closePath();
        shape(v, pal.out1, 2.6);
        // lapel
        v.beginPath();
        v.moveTo(96 + s * 5, 100); v.lineTo(96 + s * 24, 104); v.lineTo(96 + s * 10, 122);
        v.closePath(); v.fill(pal.out1Dark);
      }
      // button
      v.beginPath(); v.circle(96, 122, 2.6); v.fill(pal.out2);
      break;
    }
    case "vest": {
      drawTorsoBase(v, pal.out1);
      // shirt collar + buttons
      v.beginPath(); v.moveTo(88, 96); v.lineTo(96, 104); v.lineTo(104, 96);
      const lw = v.lineWidth; v.lineWidth = 2.4; v.stroke(pal.out1Dark); v.lineWidth = lw;
      v.limb(96, 106, 96, 130, 2.2, pal.out1Dark);
      // vest panels
      for (const s of [-1, 1]) {
        v.beginPath();
        v.moveTo(96 + s * 10, 96);
        v.lineTo(96 + s * 32, 96);
        v.lineTo(96 + s * 28, 134);
        v.lineTo(96 + s * 12, 134);
        v.closePath();
        shape(v, pal.out2, 2.4);
      }
      // tie
      v.beginPath();
      v.moveTo(92, 104); v.lineTo(100, 104); v.lineTo(102, 112); v.lineTo(96, 130); v.lineTo(90, 112);
      v.closePath(); shape(v, vShade(pal.out2, -0.25), 2);
      v.beginPath(); v.moveTo(92, 104); v.lineTo(100, 104); v.lineTo(98, 110); v.lineTo(94, 110); v.closePath();
      v.fill(vShade(pal.out2, -0.45));
      break;
    }
    case "smartShirt": {
      drawTorsoBase(v, vGradient(64, 94, 64, 134, [
        { offset: 0, color: pal.out1Light }, { offset: 1, color: pal.out1 },
      ]));
      // collar
      for (const s of [-1, 1]) {
        v.beginPath();
        v.moveTo(96 + s * 3, 96); v.lineTo(96 + s * 16, 98); v.lineTo(96 + s * 8, 108); v.lineTo(96 + s * 2, 104);
        v.closePath(); shape(v, pal.out1Dark, 2);
      }
      // buttons
      for (const y of [110, 118, 126]) { v.beginPath(); v.circle(96, y, 2.2); v.fill(pal.out1Dark); }
      break;
    }
    case "cardigan": {
      drawTorsoBase(v, pal.out1);
      for (const s of [-1, 1]) {
        v.beginPath();
        v.moveTo(96 + s * 8, 96);
        v.lineTo(96 + s * 32, 96);
        v.lineTo(96 + s * 28, 134);
        v.lineTo(96 + s * 10, 134);
        v.closePath();
        shape(v, pal.out2, 2.4);
      }
      break;
    }
    case "suit": {
      drawTorsoBase(v, pal.out1);
      // shirt V + tie
      v.beginPath();
      v.moveTo(86, 96); v.lineTo(106, 96); v.lineTo(96, 118);
      v.closePath(); v.fill("#f5f0e6");
      for (const s of [-1, 1]) {
        v.beginPath();
        v.moveTo(96 + s * 4, 96); v.lineTo(96 + s * 20, 100); v.lineTo(96 + s * 8, 120);
        v.closePath(); v.fill(pal.out1Dark);
      }
      v.beginPath();
      v.moveTo(93, 102); v.lineTo(99, 102); v.lineTo(101, 109); v.lineTo(96, 126); v.lineTo(91, 109);
      v.closePath(); shape(v, pal.out2, 2);
      // pocket square
      v.beginPath();
      v.moveTo(108, 112); v.lineTo(118, 112); v.lineTo(114, 106); v.lineTo(112, 110);
      v.closePath(); v.fill("#f5f0e6");
      break;
    }
    case "polo": {
      drawTorsoBase(v, vGradient(64, 94, 64, 134, [
        { offset: 0, color: pal.out1Light }, { offset: 1, color: pal.out1 },
      ]));
      for (const s of [-1, 1]) {
        v.beginPath();
        v.moveTo(96 + s * 2, 96); v.lineTo(96 + s * 15, 97); v.lineTo(96 + s * 7, 106);
        v.closePath(); shape(v, pal.out1Dark, 2);
      }
      for (const y of [110, 116]) { v.beginPath(); v.circle(96, y, 2); v.fill(pal.out1Dark); }
      break;
    }
    case "uniform": {
      drawTorsoBase(v, vGradient(64, 94, 64, 134, [
        { offset: 0, color: pal.out1Light }, { offset: 1, color: pal.out1 },
      ]));
      // shoulder boards
      for (const s of [-1, 1]) {
        v.beginPath(); v.roundRect(96 + s * 30 - 9, 94, 18, 7, 3);
        shape(v, pal.out2, 2);
      }
      // name tag
      v.beginPath(); v.roundRect(102, 108, 16, 7, 2); shape(v, "#f5f0e6", 1.6);
      break;
    }
  }
}

/** Legs + shoes, front view. */
function drawLegsFront(
  v: VCtx, style: OutfitStyle, pal: VPal,
  legL: [number, number], legR: [number, number],
): void {
  const street = style === "streetTee";
  const hipY = 132;
  const thighL = 15, shinL = 19;
  const pantsW = street ? 15 : 11;
  const pantsC = street ? pal.out2 : pal.trouser;
  const pantsD = street ? pal.out2Dark : pal.trouserDark;
  let idx = 0;
  for (const [sx, [a1, a2]] of [[84, legL], [108, legR]] as [number, [number, number]][]) {
    const { ex, ey, hx, hy } = limbPoints(sx, hipY, a1, a2, thighL, shinL);
    // thigh
    v.limb(sx, hipY, ex, ey, pantsW, pantsC);
    // shin
    v.limb(ex, ey, hx, hy, pantsW - 2, pantsC);
    // cuff shading
    v.beginPath(); v.circle(ex, ey, (pantsW - 2) / 2);
    const lw = v.lineWidth; v.lineWidth = 2; v.stroke(pantsD); v.lineWidth = lw;
    if (street && idx === 0) {
      // cargo flap pockets on outer thighs
      for (const px of [70, 122]) {
        v.beginPath(); v.roundRect(px - 8, 140, 16, 12, 3);
        shape(v, pantsD, 2);
        v.limb(px - 8, 144, px + 8, 144, 2, vShade(pal.out2, -0.5));
      }
    }
    // shoe
    const sw = street ? 15 : 12;
    v.save(); v.translate(hx, hy + 4); v.rotate(a1 * 0.4);
    v.beginPath(); v.roundRect(-sw / 2, -4, sw, 12, 5);
    shape(v, pal.shoe, 2.4);
    if (street) {
      // white sole + toe cap
      v.beginPath(); v.roundRect(-sw / 2, 4, sw, 4.5, 2); v.fill(pal.sole);
      v.beginPath(); v.ellipse(sw / 2 - 4, 0, 5, 4.5, 0); v.fill(pal.sole);
    } else {
      v.globalAlpha = 0.5;
      v.beginPath(); v.ellipse(-2, -1, 4, 2.5, -0.3); v.fill(pal.sole);
      v.globalAlpha = 1;
    }
    v.restore();
    idx++;
  }
}

// ---------------------------------------------------------------------------
// Accessories — front view
// ---------------------------------------------------------------------------

function drawAccessoryFront(v: VCtx, acc: AccessoryKind, pal: VPal): void {
  const lw = v.lineWidth;
  switch (acc) {
    case "ribbon": {
      const bx = 130, by = 30;
      for (const s of [-1, 1]) {
        v.beginPath();
        v.moveTo(bx, by); v.lineTo(bx + s * 16, by - 9); v.lineTo(bx + s * 13, by + 8);
        v.closePath(); shape(v, pal.out2, 2.2);
      }
      v.beginPath(); v.circle(bx, by, 4.5); shape(v, vShade(pal.out2, -0.25), 2);
      break;
    }
    case "roundGlasses": {
      v.lineWidth = 2.8;
      for (const cx of [79, 113]) { v.beginPath(); v.circle(cx, 58, 10.5); v.stroke(pal.outline); }
      v.beginPath(); v.moveTo(89.5, 58); v.lineTo(102.5, 58); v.stroke(pal.outline);
      v.lineWidth = lw;
      break;
    }
    case "rectGlasses": {
      v.lineWidth = 2.8;
      for (const cx of [79, 113]) { v.beginPath(); v.roundRect(cx - 11, 50, 22, 15, 4); v.stroke(pal.outline); }
      v.beginPath(); v.moveTo(90, 57); v.lineTo(102, 57); v.stroke(pal.outline);
      v.lineWidth = lw;
      break;
    }
    case "headphones": {
      v.lineWidth = 6;
      v.beginPath(); v.moveTo(60, 52); v.quadraticCurveTo(62, 6, 96, 6); v.quadraticCurveTo(130, 6, 132, 52);
      v.stroke(pal.out2Dark); v.lineWidth = lw;
      for (const cx of [58, 134]) {
        v.beginPath(); v.roundRect(cx - 8, 44, 16, 24, 7);
        shape(v, pal.out2, 2.4);
      }
      break;
    }
    case "beret": {
      v.save(); v.translate(112, 16); v.rotate(0.18);
      v.beginPath(); v.ellipse(0, 0, 26, 13, 0); shape(v, pal.out2, 2.6);
      v.beginPath(); v.circle(0, -13, 3); v.fill(pal.out2Dark);
      v.restore();
      break;
    }
    case "starPin": {
      v.beginPath();
      const pts = starPts(66, 36, 9, 4);
      v.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) v.lineTo(pts[i][0], pts[i][1]);
      v.closePath(); shape(v, "#ffd75e", 2);
      break;
    }
    case "cap": {
      v.beginPath(); v.ellipse(96, 30, 34, 20, 0); shape(v, pal.out2, 2.6);
      v.beginPath(); v.ellipse(96, 44, 44, 10, 0); shape(v, vShade(pal.out2, -0.2), 2.4);
      v.beginPath(); v.circle(96, 12, 3.4); v.fill(pal.out2Dark);
      break;
    }
    case "headsetMic": {
      v.lineWidth = 3.4;
      v.beginPath(); v.moveTo(62, 50); v.quadraticCurveTo(64, 10, 96, 10); v.quadraticCurveTo(128, 10, 130, 50);
      v.stroke(pal.outline); v.lineWidth = lw;
      v.beginPath(); v.roundRect(126, 46, 13, 20, 6); shape(v, pal.out2Dark, 2);
      // mic boom to mouth
      v.lineWidth = 2.6;
      v.beginPath(); v.moveTo(132, 62); v.quadraticCurveTo(122, 74, 106, 76); v.stroke(pal.outline);
      v.beginPath(); v.circle(104, 76, 3.4); v.fill(pal.outline);
      v.lineWidth = lw;
      break;
    }
    case "messengerBag": {
      // strap over the right shoulder (viewer-right) to left hip
      v.limb(122, 98, 66, 142, 9, "#26262e");
      // bag body at viewer-left hip
      v.beginPath(); v.roundRect(40, 128, 40, 44, 9);
      shape(v, "#2b2b34", 3);
      // flap
      v.beginPath(); v.roundRect(40, 128, 40, 18, 8); shape(v, "#34343e", 2.4);
      // buckle
      v.beginPath(); v.roundRect(55, 148, 10, 9, 2); shape(v, "#8a8a96", 1.8);
      break;
    }
    case "none":
      break;
  }
}

// ---------------------------------------------------------------------------
// Prayer outfits — front view
// ---------------------------------------------------------------------------

function drawPrayerFront(v: VCtx, wear: PrayerWear, pal: VPal, pose: PoseSpec): void {
  if (wear === "mukena") {
    // white veil: big soft mass from head to feet, face oval open
    v.beginPath();
    v.smoothClosed([
      [52, 150], [48, 90], [56, 40], [72, 14], [96, 6], [120, 14],
      [136, 40], [144, 90], [140, 150], [128, 176], [96, 182], [64, 176],
    ]);
    v.fill(vGradient(96, 6, 96, 182, [
      { offset: 0, color: pal.veil }, { offset: 1, color: pal.veilDark },
    ]));
    const lw = v.lineWidth; v.lineWidth = 3.2; v.stroke(OUT); v.lineWidth = lw;
    // face opening
    v.beginPath(); v.ellipse(96, 56, 27, 30, 0); v.fill(pal.skin);
    v.lineWidth = 2.6; v.stroke(pal.veilDark); v.lineWidth = lw;
    drawEyesFront(v, pal, false, false, 0);
    drawBrowsFront(v, pal, false, 0);
    drawMouthFront(v, pal, "flat", 0);
    // folded hands hint at front
    if (pose.lean < 0.5) {
      v.beginPath(); v.ellipse(96, 128, 12, 9, 0); shape(v, pal.skin, 2.2);
    }
  } else {
    // sarung + peci: black cap, normal torso, long sarong
    v.beginPath();
    v.roundRect(62, 128, 68, 50, 12);
    shape(v, pal.out2, 3);
    v.lineWidth = 2;
    v.beginPath(); v.moveTo(80, 132); v.lineTo(78, 174); v.stroke(pal.out2Dark);
    v.beginPath(); v.moveTo(112, 132); v.lineTo(114, 174); v.stroke(pal.out2Dark);
    v.lineWidth = 3;
    // peci cap (drawn after hair — caller draws hair first, we cover top)
    v.beginPath(); v.ellipse(96, 26, 30, 16, 0); shape(v, pal.peci, 2.6);
  }
}

// ---------------------------------------------------------------------------
// Full figure — front view
// ---------------------------------------------------------------------------

function drawFigureFront(
  v: VCtx, preset: CharacterPreset, pal: VPal,
  pose: PoseSpec, blink: boolean, prayer: PrayerVariant,
): void {
  const cool = preset.expression === "cool";
  v.save();
  v.translate(0, pose.dy);

  // lean pivot at hips for bowing
  const leanActive = Math.abs(pose.lean) > 0.01;
  if (leanActive) { v.translate(96, 132); v.rotate(pose.lean); v.translate(-96, -132); }

  // ---- back hair (long styles) ----
  if (preset.hairStyle === "hime" || preset.hairStyle === "wavy") {
    // drawn in drawHairFront already (panels); nothing extra needed
  }

  // ---- legs + shoes ----
  if (prayer === "sarungPeci") {
    // sarong replaces legs (drawn in prayer); still draw shoes peeking
    v.save(); v.translate(84, 172); v.beginPath(); v.roundRect(-8, -4, 16, 10, 4); shape(v, pal.shoe, 2); v.restore();
    v.save(); v.translate(108, 172); v.beginPath(); v.roundRect(-8, -4, 16, 10, 4); shape(v, pal.shoe, 2); v.restore();
  } else if (prayer !== "mukena") {
    drawLegsFront(v, preset.outfitStyle, pal, pose.legL, pose.legR);
  }

  // ---- torso ----
  if (prayer !== "mukena") drawOutfitFront(v, preset.outfitStyle, pal);

  // ---- arms ----
  if (prayer !== "mukena") {
    const rolled = preset.outfitStyle === "smartShirt";
    const short = preset.outfitStyle === "streetTee" || preset.outfitStyle === "polo";
    for (const [sx, [a1, a2]] of [[68, pose.armL], [124, pose.armR]] as [number, [number, number]][]) {
      const { ex, ey, hx, hy } = limbPoints(sx, 100, a1, a2, 20, 18);
      const sleeveC = short ? pal.out1 : vShade(pal.out1, -0.12);
      // upper arm (sleeve)
      v.limb(sx, 100, ex, ey, 13, short || rolled ? pal.skin : sleeveC);
      if (!short && !rolled) {
        // sleeve cuff
        v.beginPath(); v.circle(ex, ey, 6.5);
        const lw = v.lineWidth; v.lineWidth = 2; v.stroke(pal.out1Dark); v.lineWidth = lw;
      }
      // forearm
      const foreC = rolled || short ? pal.skin : sleeveC;
      v.limb(ex, ey, hx, hy, 10.5, foreC);
      // hand
      v.beginPath(); v.circle(hx, hy, 6.4); shape(v, pal.skin, 2.2);
    }
  }

  // ---- messenger bag strap over torso (in front of torso, behind arms is fine here) ----
  // (drawn in accessories; strap part needs torso behind — draw now for layering)
  if (preset.accessory === "messengerBag" && !prayer) {
    v.limb(122, 98, 64, 144, 9, "#26262e");
  }

  // ---- neck + head ----
  if (prayer !== "mukena") {
    v.beginPath(); v.roundRect(88, 82, 16, 14, 6); shape(v, pal.skinDark, 2.4);
    v.save();
    v.translate(96, 54 + pose.headDy); v.rotate(pose.headTilt);
    v.beginPath(); v.ellipse(0, 0, 36, 34, 0);
    v.fill(vGradient(-30, -30, 30, 30, [
      { offset: 0, color: pal.skin }, { offset: 1, color: vShade(pal.skin, -0.08) },
    ]));
    const lw = v.lineWidth; v.lineWidth = 3; v.stroke(OUT); v.lineWidth = lw;
    // ears
    for (const s of [-1, 1]) {
      v.beginPath(); v.ellipse(s * 35, 4, 6, 8, 0); shape(v, pal.skin, 2.2);
    }
    v.restore();
  }

  // ---- hair (behind face features, over head top) ----
  if (prayer !== "mukena") {
    drawHairFront(v, preset.hairStyle, pal);
  } else {
    // mukena veil replaces hair entirely
  }

  // ---- face ----
  if (prayer !== "mukena") {
    v.save();
    v.translate(96, 54 + pose.headDy); v.rotate(pose.headTilt);
    v.translate(-96, -54);
    const m = prayer ? "flat" : pose.mouth;
    const useCool = prayer ? false : cool;
    drawBrowsFront(v, pal, useCool, pose.headDy);
    drawEyesFront(v, pal, useCool, blink, pose.headDy);
    // nose hint
    v.beginPath(); v.circle(96, 68 + pose.headDy, 1.6); v.fill(pal.skinDeep);
    drawMouthFront(v, pal, useCool && m === "smile" ? "smirk" : m, pose.headDy);
    v.restore();
  }

  // ---- prayer overlays ----
  if (prayer) drawPrayerFront(v, prayer, pal, pose);

  // ---- accessories (over hair) ----
  if (!prayer) drawAccessoryFront(v, preset.accessory, pal);
  // peci drawn inside prayer for sarungPeci — but hair was drawn; cover it:
  if (prayer === "sarungPeci") {
    v.beginPath(); v.ellipse(96, 24 + pose.dy * 0 + pose.headDy, 30, 15, 0);
    shape(v, pal.peci, 2.6);
  }

  v.restore();
}

// ---------------------------------------------------------------------------
// Side view (facing +x; mirrored by the scene for the other side)
// ---------------------------------------------------------------------------

function drawFigureSide(
  v: VCtx, preset: CharacterPreset, pal: VPal,
  pose: PoseSpec, blink: boolean, prayer: PrayerVariant,
): void {
  const cx = 96;
  v.save();
  v.translate(0, pose.dy);

  // legs (near + far)
  if (prayer !== "mukena") {
    const street = preset.outfitStyle === "streetTee";
    const pantsC = street ? pal.out2 : pal.trouser;
    let i = 0;
    for (const [dx, [a1, a2]] of [[-5, pose.legL], [6, pose.legR]] as [number, [number, number]][]) {
      const { ex, ey, hx, hy } = limbPoints(cx + dx, 132, a1, a2, 15, 19);
      const wdt = i === 0 ? 12 : 10;
      v.limb(cx + dx, 132, ex, ey, wdt, i === 0 ? pantsC : vShade(street ? pal.out2 : pal.trouser, -0.15));
      v.limb(ex, ey, hx, hy, wdt - 1.5, i === 0 ? pantsC : vShade(street ? pal.out2 : pal.trouser, -0.15));
      // shoe in profile
      v.save(); v.translate(hx + 3, hy + 4); v.rotate(a1 * 0.3);
      v.beginPath(); v.roundRect(-9, -5, 22, 12, 5); shape(v, pal.shoe, 2.2);
      if (street) { v.beginPath(); v.roundRect(-9, 3, 22, 4.5, 2); v.fill(pal.sole); }
      v.restore();
      i++;
    }
  }

  // torso in profile
  if (prayer !== "mukena") {
    v.beginPath(); v.roundRect(cx - 24, 94, 48, 40, 14);
    shape(v, preset.outfitStyle === "streetTee" ? pal.out1 : pal.out1, 3);
    // outfit hint: tie / lapel edge
    if (["suit", "vest", "blazer"].includes(preset.outfitStyle)) {
      v.limb(cx + 14, 98, cx + 10, 130, 3, pal.out1Dark);
    }
  }

  // arms: far (darker, behind) then near
  if (prayer !== "mukena") {
    const drawArm = (dx: number, a: [number, number], dark: boolean) => {
      const { ex, ey, hx, hy } = limbPoints(cx + dx, 100, a[0], a[1], 20, 18);
      const c = dark ? vShade(pal.out1, -0.25) : pal.out1;
      v.limb(cx + dx, 100, ex, ey, 12, c);
      v.limb(ex, ey, hx, hy, 10, dark ? vShade(pal.skin, -0.2) : pal.skin);
      v.beginPath(); v.circle(hx, hy, 6); shape(v, dark ? vShade(pal.skin, -0.2) : pal.skin, 2);
    };
    drawArm(-6, pose.legL[0] > 0 ? pose.armL : pose.armL, true);
    drawArm(8, pose.armR, false);
  }

  // neck + head profile
  if (prayer !== "mukena") {
    v.beginPath(); v.roundRect(cx - 7, 82, 15, 13, 6); shape(v, pal.skinDark, 2.2);
    v.save(); v.translate(cx + 2, 54 + pose.headDy); v.rotate(pose.headTilt);
    v.beginPath(); v.ellipse(0, 0, 33, 32, 0);
    v.fill(vGradient(-28, -28, 28, 28, [
      { offset: 0, color: pal.skin }, { offset: 1, color: vShade(pal.skin, -0.08) },
    ]));
    const lw = v.lineWidth; v.lineWidth = 3; v.stroke(OUT); v.lineWidth = lw;
    // nose bump (facing +x)
    v.beginPath();
    v.moveTo(30, 8); v.lineTo(37, 14); v.lineTo(30, 17);
    v.closePath(); shape(v, pal.skin, 2);
    v.restore();
    // hair side mass
    drawHairSide(v, preset.hairStyle, pal, cx);
    // face in profile
    v.save(); v.translate(cx + 2, 54 + pose.headDy);
    if (blink) {
      v.beginPath(); v.moveTo(8, 2); v.quadraticCurveTo(16, 5, 24, 2);
      const lw2 = v.lineWidth; v.lineWidth = 3; v.stroke(pal.outline); v.lineWidth = lw2;
    } else {
      v.beginPath(); v.ellipse(16, 2, 8, 9.5, 0); v.fill("#ffffff");
      v.beginPath(); v.circle(18, 3.5, 5); v.fill(pal.eye);
      v.beginPath(); v.circle(18, 3.5, 2.6); v.fill(pal.outline);
      v.beginPath(); v.circle(16.4, 1.4, 1.6); v.fill("#ffffff");
      v.beginPath(); v.moveTo(6, -4); v.quadraticCurveTo(16, -8, 26, -4);
      const lw2 = v.lineWidth; v.lineWidth = 3.2; v.stroke(pal.outline); v.lineWidth = lw2;
    }
    // brow
    v.limb(6, -12, 26, -14, 4, pal.outline);
    // mouth
    if (pose.mouth === "open") { v.beginPath(); v.ellipse(20, 20, 4.5, 6, 0); v.fill("#7c3333"); }
    else { v.beginPath(); v.moveTo(14, 20); v.quadraticCurveTo(21, 23, 27, 19); const lw2 = v.lineWidth; v.lineWidth = 2.6; v.stroke(pal.mouth); v.lineWidth = lw2; }
    v.restore();
  }

  if (prayer) drawPrayerSide(v, prayer, pal, cx);
  v.restore();
}

function drawHairSide(v: VCtx, style: HairStyle, pal: VPal, cx: number): void {
  const paint = (pts: [number, number][]) => {
    v.beginPath(); v.smoothClosed(pts);
    v.fill(vGradient(cx - 30, 10, cx + 30, 80, [
      { offset: 0, color: pal.hairLight }, { offset: 0.5, color: pal.hair }, { offset: 1, color: pal.hairDark },
    ]));
    const lw = v.lineWidth; v.lineWidth = 3; v.stroke(OUT); v.lineWidth = lw;
  };
  switch (style) {
    case "wildSpikes":
    case "spiky":
    case "messy": {
      const n = style === "wildSpikes" ? 12 : 9;
      const pts = spikeRing(cx, 46, { a0: Math.PI * 0.9, a1: Math.PI * 2.1, n, rO: style === "wildSpikes" ? 58 : 48, rI: 38, jitter: 4 }, 0.92);
      v.beginPath();
      v.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) v.lineTo(pts[i][0], pts[i][1]);
      v.closePath();
      v.fill(pal.hair);
      const lw = v.lineWidth; v.lineWidth = 3; v.stroke(OUT); v.lineWidth = lw;
      break;
    }
    case "hime":
    case "wavy":
      paint([[cx - 34, 60], [cx - 36, 120], [cx - 24, 128], [cx - 18, 70], [cx - 30, 30], [cx - 10, 12], [cx + 24, 12], [cx + 34, 34], [cx + 30, 60], [cx + 10, 52]]);
      break;
    case "bob":
      paint([[cx - 32, 66], [cx - 32, 36], [cx - 14, 14], [cx + 18, 14], [cx + 32, 38], [cx + 30, 64], [cx + 12, 56]]);
      break;
    case "twintails": {
      paint([[cx - 30, 50], [cx - 12, 16], [cx + 20, 16], [cx + 32, 48], [cx + 14, 44]]);
      v.save(); v.translate(cx - 34, 60);
      v.beginPath(); v.smoothClosed([[0, -8], [20, 8], [24, 48], [12, 84], [-2, 86], [-8, 48]]);
      v.fill(pal.hair); const lw = v.lineWidth; v.lineWidth = 3; v.stroke(OUT); v.lineWidth = lw;
      v.restore();
      break;
    }
    case "ponytail": {
      paint([[cx - 30, 50], [cx - 12, 16], [cx + 20, 16], [cx + 32, 48], [cx + 14, 44]]);
      v.save(); v.translate(cx + 26, 30);
      v.beginPath(); v.smoothClosed([[0, -8], [22, 4], [28, 40], [18, 76], [4, 78], [-4, 44]]);
      v.fill(pal.hair); const lw2 = v.lineWidth; v.lineWidth = 3; v.stroke(OUT); v.lineWidth = lw2;
      v.restore();
      break;
    }
    case "short":
      paint([[cx - 30, 56], [cx - 30, 34], [cx - 12, 14], [cx + 18, 14], [cx + 30, 36], [cx + 28, 54], [cx + 10, 48]]);
      break;
  }
}

function drawPrayerSide(v: VCtx, wear: PrayerWear, pal: VPal, cx: number): void {
  if (wear === "mukena") {
    v.beginPath();
    v.smoothClosed([
      [cx - 44, 150], [cx - 46, 90], [cx - 38, 40], [cx - 22, 14], [cx + 2, 6],
      [cx + 26, 14], [cx + 40, 40], [cx + 46, 90], [cx + 44, 150], [cx + 30, 176], [cx, 182], [cx - 32, 176],
    ]);
    v.fill(vGradient(cx, 6, cx, 182, [
      { offset: 0, color: pal.veil }, { offset: 1, color: pal.veilDark },
    ]));
    const lw = v.lineWidth; v.lineWidth = 3.2; v.stroke(OUT); v.lineWidth = lw;
    v.beginPath(); v.ellipse(cx + 4, 56, 24, 28, 0); v.fill(pal.skin);
    v.lineWidth = 2.6; v.stroke(pal.veilDark); v.lineWidth = lw;
  } else {
    v.beginPath(); v.roundRect(cx - 30, 128, 60, 50, 12); shape(v, pal.out2, 3);
    v.beginPath(); v.ellipse(cx, 24, 28, 14, 0); shape(v, pal.peci, 2.6);
  }
}

// ---------------------------------------------------------------------------
// Back view
// ---------------------------------------------------------------------------

function drawFigureBack(
  v: VCtx, preset: CharacterPreset, pal: VPal,
  pose: PoseSpec, prayer: PrayerVariant,
): void {
  v.save();
  v.translate(0, pose.dy);

  if (prayer !== "mukena") {
    // legs
    for (const [sx, [a1, a2]] of [[84, pose.legL], [108, pose.legR]] as [number, [number, number]][]) {
      const { ex, ey, hx, hy } = limbPoints(sx, 132, a1, a2, 15, 19);
      const c = preset.outfitStyle === "streetTee" ? pal.out2 : pal.trouser;
      v.limb(sx, 132, ex, ey, 12, c);
      v.limb(ex, ey, hx, hy, 10.5, c);
      v.save(); v.translate(hx, hy + 4);
      v.beginPath(); v.roundRect(-7, -4, 14, 12, 5); shape(v, pal.shoe, 2.2);
      v.restore();
    }
    // torso back
    v.beginPath(); v.roundRect(64, 94, 64, 40, 15); shape(v, pal.out1, 3);
    // arms
    for (const [sx, [a1, a2]] of [[68, pose.armL], [124, pose.armR]] as [number, [number, number]][]) {
      const { ex, ey, hx, hy } = limbPoints(sx, 100, a1, a2, 20, 18);
      v.limb(sx, 100, ex, ey, 12.5, vShade(pal.out1, -0.12));
      v.limb(ex, ey, hx, hy, 10, vShade(pal.skin, -0.08));
      v.beginPath(); v.circle(hx, hy, 6); shape(v, vShade(pal.skin, -0.08), 2);
    }
  }

  // hair back mass — full coverage, style-specific silhouette
  drawHairBack(v, preset.hairStyle, pal);

  if (prayer === "mukena") {
    v.beginPath();
    v.smoothClosed([
      [52, 150], [48, 90], [56, 40], [72, 14], [96, 6], [120, 14],
      [136, 40], [144, 90], [140, 150], [128, 176], [96, 182], [64, 176],
    ]);
    v.fill(vGradient(96, 6, 96, 182, [
      { offset: 0, color: pal.veil }, { offset: 1, color: pal.veilDark },
    ]));
    const lw = v.lineWidth; v.lineWidth = 3.2; v.stroke(OUT); v.lineWidth = lw;
  } else if (prayer === "sarungPeci") {
    v.beginPath(); v.roundRect(62, 128, 68, 50, 12); shape(v, pal.out2, 3);
  }

  v.restore();
}

function drawHairBack(v: VCtx, style: HairStyle, pal: VPal): void {
  const grad = vGradient(96, 0, 96, 110, [
    { offset: 0, color: pal.hairLight }, { offset: 0.5, color: pal.hair }, { offset: 1, color: pal.hairDark },
  ]);
  const blob = (pts: [number, number][]) => {
    v.beginPath(); v.smoothClosed(pts); v.fill(grad);
    const lw = v.lineWidth; v.lineWidth = 3.2; v.stroke(OUT); v.lineWidth = lw;
  };
  switch (style) {
    case "wildSpikes":
    case "spiky":
    case "messy": {
      const n = style === "wildSpikes" ? 13 : 9;
      const pts = spikeRing(96, 48, { a0: Math.PI * 0.85, a1: Math.PI * 2.15, n, rO: style === "wildSpikes" ? 60 : 50, rI: 40, jitter: 4 }, 0.95);
      v.beginPath();
      v.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) v.lineTo(pts[i][0], pts[i][1]);
      v.closePath(); v.fill(grad);
      const lw = v.lineWidth; v.lineWidth = 3.2; v.stroke(OUT); v.lineWidth = lw;
      break;
    }
    case "hime":
    case "wavy": {
      // solid back mass: long hair covering the whole back of the head
      const spread = style === "wavy" ? 6 : 0;
      blob([
        [62 - spread, 34], [54 - spread, 72], [54 - spread, 128], [68 - spread, 142],
        [124 + spread, 142], [138 + spread, 128], [138 + spread, 72], [130 + spread, 34],
        [114, 16], [96, 10], [78, 16],
      ]);
      // center part line for the two-panel look
      v.beginPath(); v.moveTo(96, 16); v.quadraticCurveTo(96, 70, 96, 120);
      const lw = v.lineWidth; v.lineWidth = 2.4; v.stroke(pal.hairDark); v.lineWidth = lw;
      break;
    }
    case "bob":
      blob([[58, 72], [58, 38], [68, 18], [96, 10], [124, 18], [134, 38], [134, 72], [124, 88], [68, 88]]);
      break;
    case "twintails":
      for (const s of [-1, 1]) {
        v.save(); v.translate(96 + s * 44, 58);
        v.beginPath(); v.smoothClosed([[0, -8], [s * 24, 8], [s * 30, 50], [s * 18, 90], [s * 4, 94], [s * -4, 56]]);
        v.fill(grad); const lw = v.lineWidth; v.lineWidth = 3; v.stroke(OUT); v.lineWidth = lw;
        v.restore();
      }
      blob([[62, 56], [66, 22], [96, 12], [126, 22], [130, 56], [112, 48], [80, 48]]);
      break;
    case "ponytail": {
      v.save(); v.translate(126, 36);
      v.beginPath(); v.smoothClosed([[0, -8], [24, 4], [30, 42], [20, 80], [6, 82], [-2, 48]]);
      v.fill(grad); const lw = v.lineWidth; v.lineWidth = 3; v.stroke(OUT); v.lineWidth = lw;
      v.restore();
      blob([[62, 54], [66, 22], [96, 10], [126, 22], [130, 54], [112, 46], [80, 46]]);
      break;
    }
    case "short":
      blob([[62, 60], [60, 36], [70, 18], [96, 10], [122, 18], [132, 36], [130, 60], [112, 52], [80, 52]]);
      break;
  }
}

// ---------------------------------------------------------------------------
// Frame assembly + public API
// ---------------------------------------------------------------------------

export function renderVectorFrame(
  preset: CharacterPreset,
  dir: SpriteDirection,
  anim: ChibiAnimation,
  frame: number,
  blink = false,
  prayer: PrayerVariant = null,
): Uint8ClampedArray<ArrayBuffer> {
  const v = new VCtx(VECTOR_W, VECTOR_H);
  const pal = makePalette(preset);
  const pose = poseFor(anim, ((frame % FRAME_COUNTS[anim]) + FRAME_COUNTS[anim]) % FRAME_COUNTS[anim]);
  if (dir === "front") drawFigureFront(v, preset, pal, pose, blink, prayer);
  else if (dir === "side") drawFigureSide(v, preset, pal, pose, blink, prayer);
  else drawFigureBack(v, preset, pal, pose, prayer);
  return v.resolve();
}

const frameCache = new Map<string, Uint8ClampedArray<ArrayBuffer>>();

function presetKey(p: CharacterPreset): string {
  return [
    p.agentId, p.hairStyle, p.hairColor, p.eyeColor, p.skinTone,
    p.outfitStyle, p.outfitPrimary, p.outfitSecondary, p.accessory,
    p.expression ?? "neutral", p.prayerWear ?? "none",
  ].join("~");
}

/**
 * Lazily rendered + cached vector frame. Same key model as the pixel
 * renderer's getPixelFrame.
 */
export function getVectorFrame(
  preset: CharacterPreset,
  dir: SpriteDirection,
  anim: ChibiAnimation,
  frame: number,
  blink = false,
  prayer: PrayerVariant = null,
): Uint8ClampedArray<ArrayBuffer> {
  const count = FRAME_COUNTS[anim];
  const f = ((frame % count) + count) % count;
  const key = [presetKey(preset), dir, anim, f, blink ? 1 : 0, prayer ?? "none"].join("|");
  let buf = frameCache.get(key);
  if (!buf) {
    buf = renderVectorFrame(preset, dir, anim, f, blink, prayer);
    frameCache.set(key, buf);
  }
  return buf;
}

/** Number of cached frames (for tests). */
export function vectorFrameCacheSize(): number {
  return frameCache.size;
}

/** Clear the frame cache (tests / preset invalidation). */
export function clearVectorSheetCache(): void {
  frameCache.clear();
}
