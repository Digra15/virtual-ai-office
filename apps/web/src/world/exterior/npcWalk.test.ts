import { describe, expect, it } from "vitest";
import { npcDampYaw, npcStep, npcTargetYaw } from "./npcWalk";

describe("npcStep — ping-pong walking", () => {
  it("advances in the current direction", () => {
    expect(npcStep(0, 1, 1.2, 1)).toEqual({ x: 1.2, dir: 1 });
    expect(npcStep(0, -1, 1.2, 1)).toEqual({ x: -1.2, dir: -1 });
  });

  it("turns around at both ends instead of leaving the sidewalk", () => {
    expect(npcStep(62.9, 1, 1.2, 1)).toEqual({ x: 63, dir: -1 });
    expect(npcStep(-62.9, -1, 1.2, 1)).toEqual({ x: -63, dir: 1 });
  });

  it("stays within bounds over a long walk", () => {
    let s = { x: 0, dir: 1 as 1 | -1 };
    for (let i = 0; i < 10000; i++) {
      s = npcStep(s.x, s.dir, 1.3, 0.016);
      expect(s.x).toBeGreaterThanOrEqual(-63);
      expect(s.x).toBeLessThanOrEqual(63);
    }
  });
});

describe("npc yaw", () => {
  it("targets east/west facings", () => {
    expect(npcTargetYaw(1)).toBeCloseTo(Math.PI / 2, 9);
    expect(npcTargetYaw(-1)).toBeCloseTo(-Math.PI / 2, 9);
  });

  it("takes the shortest arc (PI -> -PI/2 turns +PI/2, not -3PI/2)", () => {
    const next = npcDampYaw(Math.PI, -Math.PI / 2, 1, 1);
    expect(next).toBeCloseTo(Math.PI + Math.PI / 2, 9);
  });

  it("converges on the target", () => {
    let yaw = 0;
    for (let i = 0; i < 100; i++) yaw = npcDampYaw(yaw, Math.PI / 2, 0.016);
    expect(yaw).toBeCloseTo(Math.PI / 2, 3);
  });
});
