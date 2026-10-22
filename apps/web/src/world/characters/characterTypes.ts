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

/** Animation sets the procedural chibi rig can perform. */
export type ChibiAnimation =
  | "idle"
  | "typing"
  | "thinking"
  | "walking"
  | "meeting"
  | "celebrate";

/** Maps a live agent status to the chibi animation it should play. */
export function statusToAnimation(status: AgentStatus): ChibiAnimation {
  switch (status) {
    case "working":
      return "typing";
    case "thinking":
      return "thinking";
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
 * Full visual identity of one agent's chibi. Colors are hex strings
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
// Model sources — GLB swap-in point
// ---------------------------------------------------------------------------

/**
 * Describes where a character's 3D model comes from. The scene renders
 * through a `CharacterModelSource`; today the only implementation is the
 * procedural anime chibi below. A future GLB-based source plugs in here
 * without touching the scene, the interaction wiring, or the admin schema:
 *
 *   const glbSource: CharacterModelSource = {
 *     id: "glb",
 *     label: "GLB model (asset manifest)",
 *     supports: { hairColor: false, eyeColor: false, outfit: false, accessories: false },
 *     assetManifestUrl: "/assets/characters/manifest.json",
 *   };
 *   // and the renderer switches on source.id:
 *   //   "procedural-chibi" → <ChibiFigure preset={preset} ... />
 *   //   "glb"             → <GlbFigure url={manifest.models[preset.modelId]} ... />
 *
 * The manifest format is documented in CHARACTER_ASSET_MANIFEST_DOC below.
 * Only options a source REALLY supports are exposed in the admin editor —
 * e.g. a GLB that cannot recolor hair hides the hair-color picker.
 */
export interface CharacterModelSource {
  /** Stable id, e.g. "procedural-chibi" or "glb". */
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

/** The built-in source: procedural anime chibi, zero downloads, offline. */
export const PROCEDURAL_CHIBI_SOURCE: CharacterModelSource = {
  id: "procedural-chibi",
  label: "Procedural anime chibi (built-in)",
  supports: {
    hairColor: true,
    eyeColor: true,
    outfit: true,
    accessories: true,
  },
};

/**
 * DOCUMENTATION — approved GLB asset manifest format (for a future source).
 *
 * ```json
 * {
 *   "version": "1.0",
 *   "models": [
 *     {
 *       "id": "chibi-mika-01",
 *       "url": "/assets/characters/chibi-mika-01.glb",
 *       "attribution": "Artist name",
 *       "license": "CC0-1.0",
 *       "supports": { "hairColor": false, "eyeColor": false, "outfit": false, "accessories": false },
 *       "height": 1.6,
 *       "animations": ["idle", "typing", "thinking", "walking", "meeting", "celebrate"]
 *     }
 *   ]
 * }
 * ```
 *
 * Rules: every model needs `url`, `attribution`, and `license`; only list
 * animations the file really contains; the renderer falls back to the
 * procedural chibi when a model fails to load (never a broken scene).
 */
export const CHARACTER_ASSET_MANIFEST_DOC = "character-asset-manifest/v1";

/** Type of the `build` seam a model source provides (informational). */
export type CharacterFigureBuilder = (preset: CharacterPreset) => ReactNode;
