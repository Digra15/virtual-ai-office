import type { ReactNode } from "react";
import type { AgentStatus } from "@virtual-ai-office/shared";

/**
 * Character visual-identity schema for the Virtual AI Office.
 *
 * This module is the single source of truth for how an agent LOOKS. It is
 * deliberately pure data + pure functions (no Three.js scene code) so the
 * future admin panel can read, validate, and edit character customization
 * with the same contracts the 3D scene uses.
 */

// ---------------------------------------------------------------------------
// Animation sets
// ---------------------------------------------------------------------------

/** Animation sets the pixel sprite can perform. */
export type ChibiAnimation =
  | "idle"
  | "typing"
  | "thinking"
  | "walking"
  | "meeting"
  | "celebrate"
  | "praying";

/** Maps a live agent status to the sprite animation it should play. */
export function statusToAnimation(status: AgentStatus): ChibiAnimation {
  switch (status) {
    case "working":
      return "typing";
    case "thinking":
    case "recovering":
      // Recovering agents rest in the recovery room; the quiet "thinking"
      // idle-set reads as calm recuperation (not a dead-still frame).
      return "thinking";
    case "meeting":
      return "meeting";
    case "idle":
    case "waiting":
    case "error":
    case "offline":
    default:
      return "idle";
  }
}

// ---------------------------------------------------------------------------
// Visual identity
// ---------------------------------------------------------------------------

/** Procedural anime hair silhouettes. Each is built from shared primitives. */
export type HairStyle =
  | "hime" // long straight + blunt side locks (Nika)
  | "bob" // neat chin-length bob (Research)
  | "messy" // tousled short spikes (Coding)
  | "wavy" // long soft waves (Writing)
  | "twintails" // twin tails with ties (Design)
  | "spiky" // sharp upward spikes (Data)
  | "ponytail" // high side/back ponytail (Automation)
  | "short"; // tidy short crop (Monitoring)

export const HAIR_STYLES: HairStyle[] = [
  "hime",
  "bob",
  "messy",
  "wavy",
  "twintails",
  "spiky",
  "ponytail",
  "short",
];

/** Simplified modern outfits, built from boxes/cones/capsules. */
export type OutfitStyle =
  | "sweater" // knit sweater + skirt
  | "vest" // shirt + vest + tie
  | "hoodie" // hoodie + pocket
  | "cozy" // oversized sweater
  | "jacket" // open jacket + skirt
  | "shirtTie" // dress shirt + tie
  | "workJacket" // work jacket + belt
  | "uniform"; // dark uniform + epaulets

export const OUTFIT_STYLES: OutfitStyle[] = [
  "sweater",
  "vest",
  "hoodie",
  "cozy",
  "jacket",
  "shirtTie",
  "workJacket",
  "uniform",
];

/** Head/face accessories. */
export type AccessoryKind =
  | "ribbon"
  | "roundGlasses"
  | "headphones"
  | "beret"
  | "starPin"
  | "rectGlasses"
  | "cap"
  | "headsetMic"
  | "none";

export const ACCESSORY_KINDS: AccessoryKind[] = [
  "ribbon",
  "roundGlasses",
  "headphones",
  "beret",
  "starPin",
  "rectGlasses",
  "cap",
  "headsetMic",
  "none",
];

/**
 * Prayer outfit worn in the musola (room id "musola"). Per the user's
 * correction (2026-10-22): female characters wear a white mukena (prayer
 * veil covering head and body); male characters wear a sarong (sarung)
 * with a black peci cap.
 */
export type PrayerWear = "mukena" | "sarungPeci";

export const PRAYER_WEARS: PrayerWear[] = ["mukena", "sarungPeci"];

/**
 * Which way the sprite texture faces, chosen per frame from the angle
 * between the agent's facing vector and the camera direction (2.5D
 * directional sprites — the character no longer stares at the camera).
 * - "front": camera roughly in front of the character (sees the face)
 * - "back":  camera roughly behind the character
 * - "side":  camera roughly perpendicular; the side texture is drawn
 *   facing sprite-local +x and mirrored horizontally when the camera is
 *   on the character's other side.
 */
export type SpriteDirection = "front" | "back" | "side";

export const SPRITE_DIRECTIONS: SpriteDirection[] = ["front", "back", "side"];

/** Wrap an angle in radians to (-PI, PI]. */
export function wrapAngle(rad: number): number {
  const TAU = Math.PI * 2;
  let r = rad % TAU;
  if (r <= -Math.PI) r += TAU;
  else if (r > Math.PI) r -= TAU;
  return r;
}

export interface SpriteView {
  direction: SpriteDirection;
  /**
   * Mirror the side texture horizontally. True when the camera is on the
   * character's local +x side (sin of the relative angle > 0). Only
   * meaningful for direction === "side".
   */
  mirror: boolean;
}

/**
 * Pick the sprite texture direction from the agent's world-space facing
 * angle and the camera's world-space azimuth (both measured like
 * THREE's rotation.y: 0 = +z, atan2(dx, dz)).
 *
 * |relative angle| <= 45° → front; >= 135° → back; otherwise side.
 * Pure — unit-tested, including boundary angles and mirroring.
 */
export function selectSpriteDirection(
  facing: number,
  cameraAzimuth: number,
): SpriteView {
  const phi = wrapAngle(cameraAzimuth - facing);
  const abs = Math.abs(phi);
  if (abs <= Math.PI / 4) return { direction: "front", mirror: false };
  if (abs >= (3 * Math.PI) / 4) return { direction: "back", mirror: false };
  return { direction: "side", mirror: phi > 0 };
}

/**
 * Full visual identity of one agent's pixel-art character. Colors are hex strings
 * ("#rrggbb"). This is the shape the admin panel's character editor
 * will read and write.
 */
export interface CharacterPreset {
  /** Stable agent id this preset belongs to (never changes on rename). */
  agentId: string;
  hairStyle: HairStyle;
  hairColor: string;
  eyeColor: string;
  skinTone: string;
  outfitStyle: OutfitStyle;
  /** Main garment color. */
  outfitPrimary: string;
  /** Secondary garment color (skirt, vest, trim...). */
  outfitSecondary: string;
  accessory: AccessoryKind;
  /**
   * Prayer outfit for the musola. OPTIONAL and additive: presets written
   * before this field existed stay valid (the renderer falls back to
   * `prayerWearFor()` defaults). Admin-overridable like every other
   * visual-identity field.
   */
  prayerWear?: PrayerWear;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Validate a preset (e.g. admin-submitted JSON). Returns a list of human
 * readable problems; an empty list means the preset is valid.
 */
export function validateCharacterPreset(preset: unknown): string[] {
  const problems: string[] = [];
  if (typeof preset !== "object" || preset === null) {
    return ["preset must be an object"];
  }
  const p = preset as Record<string, unknown>;
  if (typeof p.agentId !== "string" || p.agentId.length === 0) {
    problems.push("agentId must be a non-empty string");
  }
  if (!HAIR_STYLES.includes(p.hairStyle as HairStyle)) {
    problems.push(`hairStyle must be one of: ${HAIR_STYLES.join(", ")}`);
  }
  if (!OUTFIT_STYLES.includes(p.outfitStyle as OutfitStyle)) {
    problems.push(`outfitStyle must be one of: ${OUTFIT_STYLES.join(", ")}`);
  }
  if (!ACCESSORY_KINDS.includes(p.accessory as AccessoryKind)) {
    problems.push(`accessory must be one of: ${ACCESSORY_KINDS.join(", ")}`);
  }
  // prayerWear is optional (backward compatible); when present it must be known.
  if (
    p.prayerWear !== undefined &&
    !PRAYER_WEARS.includes(p.prayerWear as PrayerWear)
  ) {
    problems.push(`prayerWear must be one of: ${PRAYER_WEARS.join(", ")}`);
  }
  for (const key of [
    "hairColor",
    "eyeColor",
    "skinTone",
    "outfitPrimary",
    "outfitSecondary",
  ]) {
    const v = p[key];
    if (typeof v !== "string" || !HEX_RE.test(v)) {
      problems.push(`${key} must be a hex color like "#rrggbb"`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Blink helper (pure, tested)
// ---------------------------------------------------------------------------

/** How long the eyes stay shut during a blink, in seconds. */
export const BLINK_DURATION = 0.14;

/**
 * Eye openness for the blink system: 1 = fully open, 0 = fully shut.
 * `t` is the animation clock, `blinkStart` the time the current blink
 * began (or -Infinity when no blink is in progress).
 */
export function eyeOpenAmount(t: number, blinkStart: number): number {
  const dt = t - blinkStart;
  if (dt < 0 || dt >= BLINK_DURATION) return 1;
  const k = dt / BLINK_DURATION; // 0 → 1 across the blink
  // Fast close, slightly slower open: triangular profile.
  return k < 0.4 ? 1 - k / 0.4 : (k - 0.4) / 0.6;
}

// ---------------------------------------------------------------------------
// Model sources — sprite-sheet swap-in point
// ---------------------------------------------------------------------------

/**
 * Describes where a character's artwork comes from. The scene renders
 * through a `CharacterModelSource`; the built-in implementation is the
 * procedural 2D pixel-art sprite below. A custom PNG sprite-sheet source
 * plugs in here without touching the scene, the interaction wiring, or
 * the admin schema:
 *
 *   const sheetSource: CharacterModelSource = {
 *     id: "sprite-sheet",
 *     label: "PNG sprite sheet (asset manifest)",
 *     supports: { hairColor: false, eyeColor: false, outfit: false, accessories: false },
 *     assetManifestUrl: "/assets/characters/manifest.json",
 *   };
 *   // and the renderer switches on source.id:
 *   //   "procedural-pixel" → pixel/pixelSprites.ts (built-in)
 *   //   "sprite-sheet"     → uploaded PNG frame sets from the manifest
 *
 * The manifest format is documented in CHARACTER_ASSET_MANIFEST_DOC below.
 * Only options a source REALLY supports are exposed in the admin editor —
 * e.g. a fixed PNG sheet that cannot recolor hair hides the hair-color
 * picker.
 */
export interface CharacterModelSource {
  /** Stable id, e.g. "procedural-pixel" or "sprite-sheet". */
  readonly id: string;
  /** Human label shown in the admin panel. */
  readonly label: string;
  /** Which appearance options this source actually supports. */
  readonly supports: {
    hairColor: boolean;
    eyeColor: boolean;
    outfit: boolean;
    accessories: boolean;
  };
  /** URL of the asset manifest (external-asset sources only). */
  readonly assetManifestUrl?: string;
}

/** The built-in source: procedural 2D pixel-art sprite, zero downloads. */
export const PROCEDURAL_PIXEL_SOURCE: CharacterModelSource = {
  id: "procedural-pixel",
  label: "Procedural pixel-art sprite (built-in)",
  supports: {
    hairColor: true,
    eyeColor: true,
    outfit: true,
    accessories: true,
  },
};

/**
 * DOCUMENTATION — custom PNG sprite-sheet manifest format.
 *
 * ```json
 * {
 *   "version": "1.0",
 *   "models": [
 *     {
 *       "id": "pixel-mika-01",
 *       "url": "/assets/characters/pixel-mika-01.png",
 *       "attribution": "Artist name",
 *       "license": "CC0-1.0",
 *       "supports": { "hairColor": false, "eyeColor": false, "outfit": false, "accessories": false },
 *       "frameWidth": 28,
 *       "frameHeight": 36,
 *       "animations": {
 *         "idle": 2, "typing": 2, "thinking": 2,
 *         "walking": 4, "meeting": 2, "celebrate": 2
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * The PNG is a horizontal strip (or grid) of 28x36 frames in row-major
 * order per the `animations` counts. Rules: every model needs `url`,
 * `attribution`, and `license`; only list animations the sheet really
 * contains; the renderer falls back to the procedural pixel sprite when a
 * sheet fails to load (never a broken scene).
 */
export const CHARACTER_ASSET_MANIFEST_DOC = "character-asset-manifest/v1";

/** Type of the `build` seam a model source provides (informational). */
export type CharacterFigureBuilder = (preset: CharacterPreset) => ReactNode;
