import { beforeEach, describe, expect, it, vi } from "vitest";
import { movement } from "./movement";
import { usePresenceStore } from "../stores/usePresenceStore";

// Minimal stand-in for THREE.Group: records transform writes.
function mockGroup() {
  return {
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    rotation: { set: vi.fn() },
  } as unknown as import("three").Group;
}

describe("movement registry", () => {
  beforeEach(() => {
    // Fresh agent each test; unregister previous ones.
    for (const id of ["a1", "a2"]) {
      try {
        movement.unregister(id);
      } catch {
        /* ignore */
      }
    }
    usePresenceStore.setState({ presences: {} });
  });

  it("registers an agent at its desk and reports seated", () => {
    const g = mockGroup();
    movement.register("a1", g, 2.5, -1.5, 0);
    expect(movement.isRegistered("a1")).toBe(true);
    expect(movement.isMoving("a1")).toBe(false);
    expect(movement.getPosition("a1")).toEqual({ x: 2.5, z: -1.5 });
    expect(g.position.set).toHaveBeenCalledWith(2.5, 0, -1.5);
    expect(usePresenceStore.getState().presences["a1"]).toEqual({
      activity: "seated",
      pose: "desk",
    });
  });

  it("walks along a path and arrives, firing onArrive once", () => {
    const g = mockGroup();
    movement.register("a1", g, 0, 0, 0);
    const onArrive = vi.fn();
    const ok = movement.moveTo(
      "a1",
      [
        { x: 3, z: 0 },
        { x: 3, z: 4 },
      ],
      { speed: 10, arriveActivity: "standing", arrivePose: "free", onArrive },
    );
    expect(ok).toBe(true);
    expect(movement.isMoving("a1")).toBe(true);
    expect(usePresenceStore.getState().presences["a1"]?.activity).toBe("walking");

    // Step the simulation in 0.1s increments until arrival.
    for (let i = 0; i < 100 && movement.isMoving("a1"); i++) {
      movement.update(0.1);
    }
    expect(movement.isMoving("a1")).toBe(false);
    const pos = movement.getPosition("a1");
    expect(pos?.x).toBeCloseTo(3);
    expect(pos?.z).toBeCloseTo(4);
    expect(onArrive).toHaveBeenCalledTimes(1);
    expect(usePresenceStore.getState().presences["a1"]).toEqual({
      activity: "standing",
      pose: "free",
    });
  });

  it("faces the movement direction while walking", () => {
    const g = mockGroup();
    movement.register("a1", g, 0, 0, 0);
    movement.moveTo("a1", [{ x: 0, z: 10 }], { speed: 5 });
    movement.update(0.1);
    // Moving +z: facing = atan2(0, 10) = 0 → rotation.set(0, 0, 0).
    const lastCall = (g.rotation.set as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    expect(lastCall?.[1]).toBeCloseTo(0);
  });

  it("applies arriveFacing on arrival", () => {
    const g = mockGroup();
    movement.register("a1", g, 0, 0, 0);
    movement.moveTo("a1", [{ x: 1, z: 0 }], {
      speed: 10,
      arriveFacing: Math.PI,
    });
    for (let i = 0; i < 50 && movement.isMoving("a1"); i++) movement.update(0.1);
    const lastCall = (g.rotation.set as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    expect(lastCall?.[1]).toBeCloseTo(Math.PI);
  });

  it("navigateTo pathfinds and returns false for unknown agents", () => {
    expect(movement.navigateTo("ghost", 5, 5)).toBe(false);
    const g = mockGroup();
    movement.register("a2", g, -7.5, -1.5, 0);
    expect(movement.navigateTo("a2", 8, 10.5)).toBe(true);
    expect(movement.isMoving("a2")).toBe(true);
  });

  it("stop() cancels movement in place", () => {
    const g = mockGroup();
    movement.register("a1", g, 0, 0, 0);
    movement.moveTo("a1", [{ x: 100, z: 0 }], { speed: 1 });
    movement.update(0.5);
    movement.stop("a1");
    expect(movement.isMoving("a1")).toBe(false);
    const pos = movement.getPosition("a1");
    expect(pos?.x).toBeGreaterThan(0);
    expect(pos?.x).toBeLessThan(100);
  });

  it("unregister removes the agent and its presence", () => {
    const g = mockGroup();
    movement.register("a1", g, 0, 0, 0);
    movement.unregister("a1");
    expect(movement.isRegistered("a1")).toBe(false);
    expect(usePresenceStore.getState().presences["a1"]).toBeUndefined();
  });
});
