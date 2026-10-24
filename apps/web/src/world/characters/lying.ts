/**
 * Lying-down (sleeping) pose for recovery-bed agents — whole-model fake,
 * exactly like the prayer poses, because the CUTES rig has no knee/waist
 * joints and cannot be posed skeletally.
 *
 * MEASURED INPUT (not guessed). Generic Female GLB, bind pose, Box3 from
 * the three.js scene graph in Node (texture load failed in that harness
 * but geometry parsed, so the box is geometry-only and unaffected):
 *   raw scene bbox min [-0.656, -0.002, -0.462]
 *   raw scene bbox max [ 0.659,  2.031,  0.686]
 *   raw size [1.316, 2.033, 1.147] (width, height, depth)
 * With CUTES_MODEL_SCALE 0.95 applied by CutesAvatar:
 *   height  H = 2.033 * 0.95 = 1.931 (feet at y=0, head top at y=H)
 *   depthMin = -0.462 * 0.95 = -0.439 (back side, model -z)
 *   depthMax =  0.686 * 0.95 =  0.652 (face side, model +z)
 *   widthHalf = 1.316 * 0.95 / 2 = 0.625
 *
 * BED GEOMETRY (RecoveryRoom.tsx, bed centre = RECOVERY_BEDS position):
 *   mattress top 0.68 (centre 0.57 + 0.11), duvet top 0.77 (0.72 + 0.05),
 *   pillow top 0.82 (0.75 + 0.07), pillow centre at bed-local z -0.68,
 *   headboard inner face at bed-local z -0.93, bed half-length 1.05,
 *   bed half-width 0.525, bed pitch 1.85 (edge gap 0.80), north wall -12
 *   (bed centre z -10.8, bed north end -11.85).
 *
 * PITCH MATH. Inner model rotation.x = -PI/2. THREE rotation about X:
 *   (x, y, z) -> (x, y*cos - z*sin, y*sin + z*cos)
 * with cos=0, sin=-1 gives (x, z, -y). So:
 *   head (0, H, 0) -> (0, 0, -H): head points along model-local -z.
 *   nose (0, 0, 1) -> (0, 1, 0): face points straight UP.
 * The outer movement group yaw then maps local -z to the world. With
 * outer yaw = LYING.facing = 0 (identity), local -z IS world -z = NORTH,
 * so the head goes north, toward the pillow, and the face goes up.
 * Proof helper: lyingHeadDirection(facing) = Ry(facing) * (0,0,-1)
 *   = (-sin(facing), 0, -cos(facing)); at facing 0 -> (0, 0, -1) north.
 *
 * PLACEMENT (model-group origin = feet, in outer-group local space):
 *   groupY = duvetTop - depthMin = 0.77 + 0.439 = 1.209 -> 1.21.
 *     Back plane then sits at 0.77: resting ON the duvet (not clipping
 *     through it), and the head presses 0.05 into the pillow (top 0.82).
 *   groupZ = H / 2 = 0.966 -> 0.97 (shifted south in local space, so
 *     the pitched body centres on the bed):
 *     head top at local z -0.96 -> world -11.76 for bed centre -10.8:
 *       south of the north wall (-12) and just kissing the headboard
 *       inner face (-0.93) — the head rests against the headboard.
 *     feet at local z +0.97 -> world -9.83, inside the bed end (-9.75).
 *     head centre (~H-0.25 from the feet) lands near local z -0.71,
 *       i.e. on the pillow (centre -0.68, spans -0.93..-0.43).
 *   Width overhang: body half-width 0.625 vs bed half-width 0.525 ->
 *     0.10/side, well inside the 0.40 half-gap to the neighbouring bed.
 *   Body length 1.931 < bed length 2.1, so NO lying-only rescale is
 *     needed; the standing scale is kept.
 *
 * HUD: body front (face side) peaks at groupY + depthMax = 1.86, so the
 *   name (2.25) and icon (1.95, bouncing to 2.10) both float above it,
 *   lower than the standing 2.6 / 2.25 but still in name-over-icon order.
 *
 * ANIMATION (see CutesAvatar): lying plays "Armature|Grounded". It was
 * chosen over Idle and Walk deliberately: Idle sways continuously
 * (reads as awake), Walk is locomotion, and Grounded has NO root/
 * armature rotation track (only small bone deltas, floppy feet), so it
 * composes safely with the whole-model pitch and stays near-static —
 * stillness reads as sleep, and the bouncing "zZ" icon carries the rest.
 */

/** Model scale applied by CutesAvatar (single source of truth). */
export const CUTES_MODEL_SCALE = 0.95;

/** Scaled CUTES measurements (see derivation above). */
export const LYING_MEASURED = {
  /** Standing height, feet (0) to head top. */
  height: 1.931,
  /** Back side extent in model +z/-z (negative = behind origin plane). */
  depthMin: -0.439,
  /** Face side extent in model +z. */
  depthMax: 0.652,
  /** Body half-width. */
  widthHalf: 0.625,
} as const;

/** Recovery-bed surface heights (RecoveryRoom.tsx). */
export const BED_SURFACES = {
  mattressTop: 0.68,
  duvetTop: 0.77,
  pillowTop: 0.82,
} as const;

/** Bed footprint constants (RecoveryRoom.tsx / floorPlan.ts). */
export const BED_GEOMETRY = {
  halfLength: 1.05,
  halfWidth: 0.525,
  /** Centre-to-centre distance between neighbouring beds. */
  pitch: 1.85,
  /** Bed-local z of the pillow centre (north = negative). */
  pillowCenterZ: -0.68,
  /** Bed-local z of the headboard inner face. */
  headboardInnerZ: -0.93,
} as const;

/** Whole-model lying transform (model group only — HUD stays upright). */
export const LYING = {
  /** Pitch back: body axis (+Y) -> local -z, face (+Z) -> up. */
  rotationX: -Math.PI / 2,
  /** Group y: back plane rests on the duvet top. */
  groupY: 1.21,
  /** Group z (local, pre-yaw): centres the pitched body on the bed. */
  groupZ: 0.97,
  /** Outer-group yaw on arrival: head points north (see proof above). */
  facing: 0,
  /** HUD heights while lying (standing: 2.6 name / 2.25 icon). */
  hudNameY: 2.25,
  hudIconY: 1.95,
  /** Clip played while lying (see rationale above). */
  animation: "Armature|Grounded",
} as const;

/** Inputs for the lying predicate (derived state, not a new activity). */
export interface LyingInput {
  /** Live agent status (e.g. "recovering", "idle"). */
  status: string;
  /** True when the agent currently holds a recovery bed. */
  hasBed: boolean;
  /** True while the movement registry reports the agent walking. */
  walking: boolean;
}

/**
 * True only for a resting agent: status "recovering", holding a bed,
 * and not walking. Everything else — walking to the bed (still "error"),
 * walking back (healthy + moving), sitting at a desk, praying, on a
 * pantry break — is false, so the pose switches off automatically the
 * moment the agent moves or resolves. No presence-store field is added:
 * deriving it here keeps desk/prayer/break poses untouched.
 */
export function isLying(input: LyingInput): boolean {
  return (
    input.status === "recovering" && input.hasBed && !input.walking
  );
}

/**
 * World-space unit vector of the head direction for a lying agent whose
 * outer-group yaw is `facing`: Ry(facing) applied to local (0,0,-1).
 * At facing 0 this is (0, 0, -1) — north, toward the pillow.
 */
export function lyingHeadDirection(facing: number): [number, number, number] {
  return [-Math.sin(facing), 0, -Math.cos(facing)];
}

/** World-space face direction for a lying agent: always straight up. */
export function lyingNoseDirection(): [number, number, number] {
  return [0, 1, 0];
}
