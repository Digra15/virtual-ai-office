import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DIFIA_STANDBY_FACING,
  DIFIA_STANDBY_SPOT,
  _receptionTickForTests,
  _resetReceptionForTests,
} from "./ReceptionDirector";
import {
  _resetWanderForTests,
  _wanderTickForTests,
} from "../wander/WanderDirector";
import { useAgentStore } from "../../stores/useAgentStore";
import { useMeetingStore } from "../../stores/useMeetingStore";
import { usePresenceStore } from "../../stores/usePresenceStore";
import { useGuestPresenceStore } from "../../stores/useGuestPresenceStore";
import { movement } from "../../world/movement";
import type { AgentInfo } from "@virtual-ai-office/shared";

function mockGroup() {
  return {
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    rotation: { set: vi.fn() },
  } as unknown as import("three").Group;
}

function seedAgents(): void {
  const mk = (id: string, workstationId: string): AgentInfo => ({
    id,
    name: id,
    role: "Test",
    status: "idle",
    currentTask: "Awaiting assignment",
    progress: null,
    lastSeen: new Date().toISOString(),
    workstationId,
    activityHistory: [],
    source: "demo",
  });
  useAgentStore.getState().applySnapshot([
    mk("difia", "reception"),
    mk("kirana", "ws-01"),
    mk("reno", "ws-02"),
  ]);
}

function setGuestActive(active: boolean): void {
  useGuestPresenceStore.setState({
    guestActive: active,
    remoteActive: active,
    remoteUnavailable: false,
    localActive: false,
  });
}

describe("reception director (Difia standby)", () => {
  beforeEach(() => {
    _resetReceptionForTests();
    _resetWanderForTests();
    usePresenceStore.setState({ presences: {} });
    useMeetingStore.setState({ meetings: [], activeMeetingId: null });
    for (const id of ["difia", "kirana", "reno"]) movement.unregister(id);
    seedAgents();
    setGuestActive(false);
  });

  it("walks Difia to the standby spot, facing the entrance, when a guest is active", () => {
    const group = mockGroup();
    movement.register("difia", group, -2.4, 7.8, Math.PI); // her reception spawn, facing north
    movement.register("kirana", mockGroup(), -4, -1.3, 0);
    movement.register("reno", mockGroup(), -2, -1.3, 0);
    setGuestActive(true);

    _receptionTickForTests();
    expect(movement.isMoving("difia")).toBe(true);

    // Walk the whole route (waypoints + destination, one hop per update).
    for (let i = 0; i < 20; i++) movement.update(30);
    expect(movement.isMoving("difia")).toBe(false);
    const pos = movement.getPosition("difia");
    expect(pos).not.toBeNull();
    expect(
      Math.hypot(
        (pos as { x: number; z: number }).x - DIFIA_STANDBY_SPOT.x,
        (pos as { x: number; z: number }).z - DIFIA_STANDBY_SPOT.z,
      ),
    ).toBeLessThanOrEqual(0.5);
    expect(usePresenceStore.getState().presences["difia"]?.activity).toBe("standing");
    expect(usePresenceStore.getState().presences["difia"]?.pose).toBe("free");
    expect(DIFIA_STANDBY_FACING).toBe(0); // south, toward the entrance
    expect(group.rotation.set).toHaveBeenCalledWith(0, 0, 0);
  });

  it("does not move Difia when no guest chat is active", () => {
    movement.register("difia", mockGroup(), -2.4, 7.8, 0);
    setGuestActive(false);
    _receptionTickForTests();
    expect(movement.isMoving("difia")).toBe(false);
  });

  it("does not yank Difia mid-prayer", () => {
    movement.register("difia", mockGroup(), -12.5, -7.5, -Math.PI / 2);
    usePresenceStore.getState().setPresence("difia", { prayerPose: "prostrate" });
    setGuestActive(true);
    _receptionTickForTests();
    expect(movement.isMoving("difia")).toBe(false);
  });

  it("wander never picks Difia while a guest chat is active", () => {
    movement.register("difia", mockGroup(), -2.4, 7.8, 0);
    movement.register("kirana", mockGroup(), -4, -1.3, 0);
    movement.register("reno", mockGroup(), -2, -1.3, 0);
    setGuestActive(true);
    for (let i = 0; i < 10; i++) _wanderTickForTests();
    expect(movement.isMoving("difia")).toBe(false);
  });
});
