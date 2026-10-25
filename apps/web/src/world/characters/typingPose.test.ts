import { describe, expect, it } from "vitest";
import {
  AnimationClip,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from "three";
import { buildTypingPoseClip, TYPING_CLIP_NAME } from "./typingPose";

/** Idle clip shaped like the bundle's: Body sway + both hand tracks. */
function fakeIdle(): AnimationClip {
  return new AnimationClip("Armature|Idle", 2.5, [
    new VectorKeyframeTrack("Body.position", [0, 1, 2.5], [0, 0, 0, 0, 0.01, 0, 0, 0, 0]),
    new VectorKeyframeTrack("HandL.position", [0, 1, 2.5], [-0.005, 0, -0.001, -0.005, 0, -0.001, -0.005, 0, -0.001]),
    new QuaternionKeyframeTrack("HandL.quaternion", [0, 1, 2.5], [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
    new VectorKeyframeTrack("HandR.position", [0, 1, 2.5], [0.005, 0, -0.003, 0.005, 0, -0.003, 0.005, 0, -0.003]),
    new QuaternionKeyframeTrack("HandR.quaternion", [0, 1, 2.5], [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
  ]);
}

describe("buildTypingPoseClip", () => {
  it("parks both hands on constant position tracks and freezes hand rotation", () => {
    const pose = buildTypingPoseClip(fakeIdle());
    expect(pose).not.toBeNull();
    expect(pose!.name).toBe(TYPING_CLIP_NAME);
    expect(pose!.duration).toBe(2.5);
    for (const bone of ["HandL", "HandR"]) {
      const pos = pose!.tracks.find((t) => t.name === `${bone}.position`)!;
      expect(pos).toBeDefined();
      // Two keyframes, same value: a static parked hand.
      expect(Array.from(pos.times)).toEqual([0, 2.5]);
      expect(pos.values[0]).toBe(pos.values[3]);
      expect(pos.values[1]).toBe(pos.values[4]);
      expect(pos.values[2]).toBe(pos.values[5]);
      // Parked forward of the rest position (toward the desk, +z local).
      expect(pos.values[2]).toBeGreaterThan(bone === "HandL" ? -0.001 : -0.003);
      const quat = pose!.tracks.find((t) => t.name === `${bone}.quaternion`)!;
      expect(Array.from(quat.times)).toEqual([0, 2.5]);
      expect(Array.from(quat.values)).toEqual([0, 0, 0, 1, 0, 0, 0, 1]);
    }
  });

  it("keeps the Body track untouched so the agent still breathes", () => {
    const pose = buildTypingPoseClip(fakeIdle());
    const body = pose!.tracks.find((t) => t.name === "Body.position")!;
    expect(body.values.length).toBe(9);
    expect(body.values[4]).toBeCloseTo(0.01);
  });

  it("returns null without an Idle clip or without hand tracks", () => {
    expect(buildTypingPoseClip(undefined)).toBeNull();
    const noHands = new AnimationClip("Armature|Idle", 1, [
      new VectorKeyframeTrack("Body.position", [0, 1], [0, 0, 0, 0, 0, 0]),
    ]);
    expect(buildTypingPoseClip(noHands)).toBeNull();
  });
});
