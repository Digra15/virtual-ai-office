import {
  AnimationClip,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from "three";

/**
 * Static "hands on keyboard" pose for a working agent seated at a desk.
 *
 * The CUTES bundle has no typing animation and no shoulder/elbow
 * joints, so a real typing motion is impossible; the user picked the
 * static variant (hands parked on the keyboard, no tapping) as the
 * safe option. This builds a pose clip from the model's own Idle clip:
 * Body/Head tracks are kept (the agent still breathes and looks
 * around), while both hand position tracks become constants parked
 * over the keyboard and both hand rotation tracks freeze on their
 * first Idle frame (fingers pointing down, tips on the keys).
 *
 * Target geometry (measured, not guessed — workstation desks, all
 * rotationY 0): the keyboard plane sits at desk-local (0, 0.792,
 * 0.16); the seated agent's origin is the chair at desk-local z +0.95
 * facing north. With the seated group at y 0.18, scale 0.95 and the
 * forward lean below, the hand targets land at world y ≈ 0.90 so the
 * fingertips (≈0.105 below the hand origin) rest on the keys.
 *
 * Bone-space mapping (measured with a three.js probe, 2026-10-25):
 * the hand bones' parent chain maps local axes to scene axes 1:1 but
 * scales translations by 100 (a +0.1 local step moved the hand +10 in
 * scene units), and every CUTES model shares the same CORE rotation
 * and hand rest positions. The deltas below are therefore the
 * scene-space shifts divided by 100, added to each model's own Idle
 * rest values.
 */
const HAND_LOCAL_DELTA: Record<string, [number, number, number]> = {
  HandL: [0.00288, 0.00259, 0.0069],
  HandR: [-0.00288, 0.00247, 0.00858],
};

/** Forward lean of the whole model while typing (radians, pitches the head toward the desk). */
export const TYPING_LEAN_X = 0.1;

/** Name of the derived pose clip (distinct from the bundle clips). */
export const TYPING_CLIP_NAME = "Armature|Typing";

/**
 * Derive the typing pose clip from an Idle clip. Returns null when the
 * Idle clip is missing or has no hand tracks, so the caller falls back
 * to plain Idle instead of breaking the avatar.
 */
export function buildTypingPoseClip(
  idle: AnimationClip | undefined,
): AnimationClip | null {
  if (!idle) return null;
  const duration = idle.duration;
  const handPos = new Map<string, [number, number, number]>();
  for (const track of idle.tracks) {
    if (track.name === "HandL.position" || track.name === "HandR.position") {
      handPos.set(track.name, [
        track.values[0],
        track.values[1],
        track.values[2],
      ]);
    }
  }
  if (!handPos.has("HandL.position") || !handPos.has("HandR.position")) {
    return null;
  }
  const tracks = idle.tracks.map((track) => {
    if (track.name === "HandL.position" || track.name === "HandR.position") {
      const bone = track.name.split(".")[0];
      const rest = handPos.get(track.name)!;
      const d = HAND_LOCAL_DELTA[bone];
      const parked = [rest[0] + d[0], rest[1] + d[1], rest[2] + d[2]];
      return new VectorKeyframeTrack(track.name, [0, duration], [
        ...parked,
        ...parked,
      ]);
    }
    if (
      track.name === "HandL.quaternion" ||
      track.name === "HandR.quaternion"
    ) {
      // Freeze the hand rotation on its first Idle frame.
      const q = [
        track.values[0],
        track.values[1],
        track.values[2],
        track.values[3],
      ];
      return new QuaternionKeyframeTrack(track.name, [0, duration], [...q, ...q]);
    }
    return track;
  });
  return new AnimationClip(TYPING_CLIP_NAME, duration, tracks);
}
