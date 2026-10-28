import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NAYLA_STANDBY_CHAIR,
  NAYLA_STANDBY_FACING,
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
import { useBriefingStore } from "../../stores/useBriefingStore";
import { _resetBriefingForTests } from "../briefing/BriefingDirector";
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
    mk("nayla", "reception"),
    mk("difia", "project"),
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

describe("reception director (Nayla standby)", () => {
  beforeEach(() => {
    _resetReceptionForTests();
    _resetBriefingForTests();
    _resetWanderForTests();
    usePresenceStore.setState({ presences: {} });
    useMeetingStore.setState({ meetings: [], activeMeetingId: null });
    for (const id of ["nayla", "difia", "kirana", "reno"]) movement.unregister(id);
    seedAgents();
    setGuestActive(false);
  });

  it("walks Nayla to the receptionist chair and sits her there, facing the entrance, when a guest is active", () => {
    const group = mockGroup();
    movement.register("nayla", group, -2.4, 7.8, Math.PI); // her reception spawn, facing north
    movement.register("kirana", mockGroup(), -4, -1.3, 0);
    movement.register("reno", mockGroup(), -2, -1.3, 0);
    setGuestActive(true);

    _receptionTickForTests();
    expect(movement.isMoving("nayla")).toBe(true);

    // Walk the whole route (staging waypoints, then the short straight
    // leg into the chair, one hop per update).
    for (let i = 0; i < 20; i++) movement.update(30);
    expect(movement.isMoving("nayla")).toBe(false);
    const pos = movement.getPosition("nayla");
    expect(pos).not.toBeNull();
    expect(
      Math.hypot(
        (pos as { x: number; z: number }).x - NAYLA_STANDBY_CHAIR.x,
        (pos as { x: number; z: number }).z - NAYLA_STANDBY_CHAIR.z,
      ),
    ).toBeLessThanOrEqual(0.5);
    expect(usePresenceStore.getState().presences["nayla"]?.activity).toBe("seated");
    expect(usePresenceStore.getState().presences["nayla"]?.pose).toBe("desk");
    expect(NAYLA_STANDBY_FACING).toBe(0); // south, toward the entrance
    expect(group.rotation.set).toHaveBeenCalledWith(0, 0, 0);
  });

  it("sits Nayla straight into the chair when she is already at the staging spot", () => {
    movement.register("nayla", mockGroup(), -4, 5.5, 0);
    setGuestActive(true);
    _receptionTickForTests();
    expect(movement.isMoving("nayla")).toBe(true);
    for (let i = 0; i < 5; i++) movement.update(30);
    expect(movement.isMoving("nayla")).toBe(false);
    const pos = movement.getPosition("nayla");
    expect(pos).not.toBeNull();
    expect(
      Math.hypot(
        (pos as { x: number; z: number }).x - NAYLA_STANDBY_CHAIR.x,
        (pos as { x: number; z: number }).z - NAYLA_STANDBY_CHAIR.z,
      ),
    ).toBeLessThanOrEqual(0.5);
    expect(usePresenceStore.getState().presences["nayla"]?.pose).toBe("desk");
  });

  it("does not move Nayla when no guest chat is active", () => {
    movement.register("nayla", mockGroup(), -2.4, 7.8, 0);
    setGuestActive(false);
    _receptionTickForTests();
    expect(movement.isMoving("nayla")).toBe(false);
  });

  it("does not yank Nayla mid-prayer", () => {
    movement.register("nayla", mockGroup(), -12.5, -7.5, -Math.PI / 2);
    usePresenceStore.getState().setPresence("nayla", { prayerPose: "prostrate" });
    setGuestActive(true);
    _receptionTickForTests();
    expect(movement.isMoving("nayla")).toBe(false);
  });

  it("does not yank Nayla to reception while she is in a Project Room briefing", () => {
    movement.register("nayla", mockGroup(), -12.5, 6.4, Math.PI);
    setGuestActive(true);
    useBriefingStore.getState().startBriefing({
      id: "brief-1",
      visitorId: "nayla",
      text: "Pesanan tamu",
      kind: "report",
    });
    _receptionTickForTests();
    expect(movement.isMoving("nayla")).toBe(false);
    _resetBriefingForTests();
  });

  it("wander never picks Nayla while a guest chat is active", () => {
    movement.register("nayla", mockGroup(), -2.4, 7.8, 0);
    movement.register("kirana", mockGroup(), -4, -1.3, 0);
    movement.register("reno", mockGroup(), -2, -1.3, 0);
    setGuestActive(true);
    for (let i = 0; i < 10; i++) _wanderTickForTests();
    expect(movement.isMoving("nayla")).toBe(false);
  });
});
