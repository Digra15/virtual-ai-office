/**
 * Procedural hairstyles modeled on top of the CUTES base (unit-tested).
 *
 * Constraint: a CUTES model's baked hair is merged into its single
 * body mesh, so it cannot be deleted without holing the head.
 * Hairstyles are therefore modeled pieces, in two families:
 *
 * - Full wigs (afro, bob, long): a shell slightly LARGER than the
 *   head mass (radius 0.65-0.70 vs ~0.55 half-width at crown, and
 *   centered slightly back so the face still protrudes through
 *   the front). The baked hair hides inside; the silhouette is
 *   fully new. Citizen 2 is excluded: its baked hair is 1.77 wide
 *   at mid-head, wider than any sane shell — it gets add-ons only.
 * - Add-ons (spiky, ponytail, bun, mohawk): pieces sitting on top
 *   of / behind the existing hair, which reads as the base hair.
 *   These work on every model, including Citizen 2.
 *
 * All values are model-local units. headTop is the model's local
 * bbox top (MODEL_HEAD_TOP / CUTES_MODEL_SCALE); eyeY and face
 * front come from the probed tables in accessories.ts.
 */

import { EYE_Y, FACE_FRONT_Z } from "./accessories";

export type HairKind =
  | "afro"
  | "bob"
  | "long"
  | "spiky"
  | "ponytail"
  | "bun"
  | "mohawk";

export interface HairParams {
  kind: HairKind;
  /** Wig shell radius (wigs only). */
  shellRadius: number;
  /** Wig shell center (wigs only). */
  shellCenter: [number, number, number];
  /** Shell front z at eye height — must stay behind the face front. */
  shellFrontAtEye: number;
  /** Shell half-width at crown height — must exceed head half-width. */
  shellHalfWidthAtCrown: number;
  /** Head top (for add-on anchoring). */
  headTop: number;
  /** Eye height (for clearance checks). */
  eyeY: number;
  /** Face front (for clearance checks). */
  faceFront: number;
}

/** Head half-width at crown height per model (probed, accessories.ts). */
export const HEAD_HALF_WIDTH: Record<string, number> = {
  "/models/cutes/Citizen 1.glb": 0.495,
  "/models/cutes/Citizen 2.glb": 0.37,
  "/models/cutes/Citizen 3.glb": 0.54,
  "/models/cutes/Crypto Bro.glb": 0.51,
  "/models/cutes/Generic Female.glb": 0.555,
  "/models/cutes/Generic Male.glb": 0.495,
  "/models/cutes/Prisoner.glb": 0.47,
  "/models/cutes/Retail Worker.glb": 0.495,
};

/** Shell radius per wig kind (local units). */
export const WIG_RADIUS: Record<string, number> = {
  afro: 0.7,
  bob: 0.65,
  long: 0.65,
};

/** Vertical squash of the shell (afros stay round, bobs/long hair flatter). */
export const WIG_Y_SCALE: Record<string, number> = {
  afro: 1,
  bob: 0.75,
  long: 0.75,
};

function shellCenterY(kind: HairKind, headTop: number, eyeY: number): number {
  return kind === "afro" ? headTop - 0.05 : eyeY + 0.15;
}

/** Horizontal radius of a (possibly squashed) shell at height y. */
function shellRadiusAtY(radius: number, yScale: number, cy: number, y: number): number {
  const t = (y - cy) / (yScale * radius);
  return Math.abs(t) < 1 ? radius * Math.sqrt(1 - t * t) : 0;
}

export function hairParams(
  kind: HairKind,
  modelUrl: string,
  headTop: number,
): HairParams {
  const eyeY = EYE_Y[modelUrl] ?? headTop - 0.3;
  const faceFront = FACE_FRONT_Z[modelUrl] ?? 0.62;
  const shellRadius = WIG_RADIUS[kind] ?? 0;
  const yScale = WIG_Y_SCALE[kind] ?? 1;
  const cy = shellCenterY(kind, headTop, eyeY);
  const cz = -0.12;
  const frontAtEye =
    shellRadius > 0 ? cz + shellRadiusAtY(shellRadius, yScale, cy, eyeY) : 0;
  const halfAtCrown =
    shellRadius > 0
      ? shellRadiusAtY(shellRadius, yScale, cy, headTop - 0.05)
      : 0;
  return {
    kind,
    shellRadius,
    shellCenter: [0, cy, cz],
    shellFrontAtEye: frontAtEye,
    shellHalfWidthAtCrown: halfAtCrown,
    headTop,
    eyeY,
    faceFront,
  };
}
