import { describe, expect, it } from "vitest";
import { NPC_WALKERS } from "./NpcWalkers";

/**
 * No-bunching rule: walkers sharing a direction share one speed, so
 * the starting spacing between them never changes — nobody catches
 * up and queues behind a slower walker.
 */
describe("NPC walker speeds", () => {
  it("same-direction walkers share one speed", () => {
    for (const dir of [1, -1] as const) {
      const speeds = new Set(
        NPC_WALKERS.filter((w) => w.startDir === dir).map((w) => w.speed),
      );
      expect(speeds.size).toBe(1);
    }
  });

  it("same-direction starters are spread out (no two within 5 m)", () => {
    for (const dir of [1, -1] as const) {
      const xs = NPC_WALKERS.filter((w) => w.startDir === dir)
        .map((w) => w.startX)
        .sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) {
        expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(5);
      }
    }
  });
});
