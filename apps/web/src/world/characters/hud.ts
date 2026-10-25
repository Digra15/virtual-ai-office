/**
 * Overhead HUD heights, per model.
 *
 * Why per model: the CUTES models are NOT the same height. Measured
 * from each GLB's bounding box (× CUTES_MODEL_SCALE 0.95):
 * most models top out at 1.81–1.93, but Citizen 2 (Design) reaches
 * 2.41 — tall hair/hat. The old fixed caption height (2.25) sat
 * INSIDE Citizen 2's hair, and the fixed name height (2.6) cleared
 * it by only 0.19. So the HUD now hugs each model's own head top
 * instead of one fixed height for all.
 *
 * Margins: the caption floats CAPTION_CLEARANCE above the head top,
 * the name sits NAME_GAP above the caption (name on top, as before).
 * The modelY argument is the model group's Y offset (0.18 when seated
 * at a desk or prostrate in prayer, 0 otherwise) — the head rises
 * with the group, so the HUD must too.
 */

export const CAPTION_CLEARANCE = 0.35;
export const NAME_GAP = 0.35;

/** Scaled head-top height per model URL (see CUTES_MODEL). */
export const MODEL_HEAD_TOP: Record<string, number> = {
  "/models/cutes/Generic Female.glb": 1.93,
  "/models/cutes/Crypto Bro.glb": 1.81,
  "/models/cutes/Generic Male.glb": 1.81,
  "/models/cutes/Citizen 3.glb": 1.91,
  "/models/cutes/Citizen 2.glb": 2.41,
  "/models/cutes/Citizen 1.glb": 1.81,
  "/models/cutes/Retail Worker.glb": 1.85,
  "/models/cutes/Prisoner.glb": 1.81,
};

/** Tallest known head top — fallback for an unlisted model. */
export const MAX_HEAD_TOP = Math.max(...Object.values(MODEL_HEAD_TOP));

export function hudHeights(
  modelUrl: string,
  modelY: number,
): { nameY: number; captionY: number } {
  const headTop = MODEL_HEAD_TOP[modelUrl] ?? MAX_HEAD_TOP;
  const captionY = headTop + modelY + CAPTION_CLEARANCE;
  return { nameY: captionY + NAME_GAP, captionY };
}
