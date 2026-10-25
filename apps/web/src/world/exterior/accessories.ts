/**
 * Real GLB accessories for NPC pedestrians (unit-tested).
 *
 * History: procedural hats were rejected twice ("kurang pas") —
 * measured geometry showed the chibi head mass is ~1 m wide, so any
 * guessed hat size sits wrong. The user then supplied real hat and
 * glasses models (poly.pizza authors below), and the remaining
 * pieces (backpack, beanie) come from 3dassets.dev (CC0). All
 * placement is computed from PROBED raw bounding boxes, never
 * guessed:
 *
 * - Hats: PolyModel centers x/z and grounds min-y, so a hat is
 *   placed with its bottom (rim) at headTop - drop and scaled so
 *   its raw width matches the chibi head (~1.0-1.15 m).
 * - Glasses: the frame is NOT symmetric front/back (lenses at the
 *   +z end, temples trailing -z), so the lens offset from the
 *   model center (probed per model) is subtracted: lenses land
 *   just proud of the face plane, temples sink into the head.
 *   Vertical center = probed eye height per model (eyes are
 *   texture, not geometry — the eye line is the middle of the
 *   foremost face surface, probed 2026-10-25).
 * - Face tables (EYE_Y, FACE_FRONT_Z) are raw GLB local units
 *   from public/models/cutes/*.glb. Citizen 2's probed front
 *   (0.83) is its tall hat/hair, not its face, so it is capped
 *   to 0.66 like the other models.
 *
 * Credits: hats/glasses user-supplied — Poly by Google, Jarlan
 * Perez, Jake Blakeley, iPoly3D, J-Toastie, jeremy; backpack +
 * beanie — 3dassets.dev (CC0).
 */

export type AccessoryId =
  | "fedora"
  | "cowboy-hat"
  | "baseball-cap-jarlan"
  | "catch-em-all-cap"
  | "baseball-cap-poly"
  | "beanie"
  | "glasses-1"
  | "glasses-2"
  | "glasses-3"
  | "sunglasses"
  | "glasses-jeremy"
  | "pixel-glasses"
  | "backpack";

import type { PolyFile } from "../PolyModel";

export interface AccessorySpec {
  file: PolyFile;
  kind: "hat" | "glasses" | "back";
  /** Raw bbox width (x) in the model's own units, probed. */
  rawWidth: number;
  /** Raw bbox height (y), probed. */
  rawHeight: number;
  /** Target width on the chibi head/body, model-local units. */
  targetWidth: number;
  /** Hats: how far below headTop the rim sits. */
  drop?: number;
  /** Glasses: lens distance forward from the model center, raw units. */
  lensOffset?: number;
}

export const ACCESSORIES: Record<AccessoryId, AccessorySpec> = {
  fedora: { file: "fedora.glb", kind: "hat", rawWidth: 484471, rawHeight: 175721, targetWidth: 1.15, drop: 0.1 },
  "cowboy-hat": { file: "cowboy-hat.glb", kind: "hat", rawWidth: 300.179, rawHeight: 142.109, targetWidth: 1.15, drop: 0.12 },
  "baseball-cap-jarlan": { file: "baseball-cap-jarlan.glb", kind: "hat", rawWidth: 0.996, rawHeight: 0.625, targetWidth: 1.05, drop: 0.2 },
  "catch-em-all-cap": { file: "catch-em-all-cap.glb", kind: "hat", rawWidth: 0.463, rawHeight: 0.222, targetWidth: 1.0, drop: 0.2 },
  "baseball-cap-poly": { file: "baseball-cap-poly.glb", kind: "hat", rawWidth: 1.815, rawHeight: 1.494, targetWidth: 1.0, drop: 0.3 },
  beanie: { file: "beanie.glb", kind: "hat", rawWidth: 0.216, rawHeight: 0.192, targetWidth: 0.86, drop: 0.25 },
  "glasses-1": { file: "glasses-1.glb", kind: "glasses", rawWidth: 2.025, rawHeight: 0.572, targetWidth: 0.75, lensOffset: 0.73 },
  "glasses-2": { file: "glasses-2.glb", kind: "glasses", rawWidth: 1.944, rawHeight: 0.707, targetWidth: 0.75, lensOffset: 0.81 },
  "glasses-3": { file: "glasses-3.glb", kind: "glasses", rawWidth: 2.056, rawHeight: 0.777, targetWidth: 0.75, lensOffset: 0.81 },
  sunglasses: { file: "sunglasses.glb", kind: "glasses", rawWidth: 0.808, rawHeight: 0.236, targetWidth: 0.75, lensOffset: 0.3 },
  "glasses-jeremy": { file: "glasses-jeremy.glb", kind: "glasses", rawWidth: 33.044, rawHeight: 8.749, targetWidth: 0.75, lensOffset: 13.39 },
  "pixel-glasses": { file: "pixel-glasses.glb", kind: "glasses", rawWidth: 2.144, rawHeight: 0.419, targetWidth: 0.75, lensOffset: 0.74 },
  backpack: { file: "backpack.glb", kind: "back", rawWidth: 0.32, rawHeight: 0.48, targetWidth: 0.38 },
};

/** Scale that makes the accessory's raw width match its target width. */
export function accessoryScale(spec: AccessorySpec): number {
  return spec.targetWidth / spec.rawWidth;
}

/** Probed eye height per CUTES model URL (raw local units). */
export const EYE_Y: Record<string, number> = {
  "/models/cutes/Citizen 1.glb": 1.64,
  "/models/cutes/Citizen 2.glb": 2.01,
  "/models/cutes/Citizen 3.glb": 1.7,
  "/models/cutes/Crypto Bro.glb": 1.6,
  "/models/cutes/Generic Female.glb": 1.72,
  "/models/cutes/Generic Male.glb": 1.63,
  "/models/cutes/Prisoner.glb": 1.62,
  "/models/cutes/Retail Worker.glb": 1.65,
};

/** Probed face-front (+z) per CUTES model URL (raw local units). */
export const FACE_FRONT_Z: Record<string, number> = {
  "/models/cutes/Citizen 1.glb": 0.6,
  "/models/cutes/Citizen 2.glb": 0.66,
  "/models/cutes/Citizen 3.glb": 0.64,
  "/models/cutes/Crypto Bro.glb": 0.64,
  "/models/cutes/Generic Female.glb": 0.65,
  "/models/cutes/Generic Male.glb": 0.6,
  "/models/cutes/Prisoner.glb": 0.6,
  "/models/cutes/Retail Worker.glb": 0.6,
};

export interface AccessoryPlacement {
  position: [number, number, number];
  scale: number;
}

/**
 * Placement for one accessory on one NPC model, in the NPC's local
 * units (inside the scaled model group). headTop is the model's
 * local bbox top (MODEL_HEAD_TOP / CUTES_MODEL_SCALE).
 */
export function accessoryPlacement(
  id: AccessoryId,
  modelUrl: string,
  headTop: number,
): AccessoryPlacement {
  const spec = ACCESSORIES[id];
  const scale = accessoryScale(spec);
  if (spec.kind === "hat") {
    return { position: [0, headTop - (spec.drop ?? 0.15), 0], scale };
  }
  if (spec.kind === "glasses") {
    const eyeY = EYE_Y[modelUrl] ?? headTop - 0.3;
    const frontZ = FACE_FRONT_Z[modelUrl] ?? 0.62;
    const lensZ = (spec.lensOffset ?? 0) * scale;
    return {
      position: [0, eyeY - (spec.rawHeight * scale) / 2, frontZ + 0.02 - lensZ],
      scale,
    };
  }
  return { position: [0, 0.72, -0.48], scale };
}
