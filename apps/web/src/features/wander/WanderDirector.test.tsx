import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetWanderForTests,
  _wanderTickForTests,
} from "./WanderDirector";
import { useAgentStore } from "../../stores/useAgentStore";
import { useMeetingStore } from "../../stores/useMeetingStore";
import { movement } from "../../world/movement";
import { usePresenceStore } from "../../stores/usePresenceStore";
import type { AgentInfo } from "@virtual-ai-office/shared";

function mockGroup() {
  return {
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    rotation: { set: vi.fn() },
  } as unknown as import("three").Group;
}

function seedAgents(): void {
  const mk = (id: string): AgentInfo => ({
    id,
    name: id,
    role: "Test",
    status: "idle",
    currentTask: "Awaiting assignment",
    progress: null,
    lastSeen: new Date().toISOString(),
    workstationId: "ws-01",
    activityHistory: [],
    source: "demo",
  });
  useAgentStore.getState().applySnapshot([
    mk("w1"),
    mk("w2"),
    mk("w3"),
    { ...mk("w4"), status: "working" },
  ]);
  for (const id of ["w1", "w2", "w3", "w4"]) {
    movement.register(id, mockGroup(), -4, -1.3, 0); // ws-01
  }
}

describe("wander director", () => {
  beforeEach(() => {
    _resetWanderForTests();
    usePresenceStore.setState({ presences: {} });
    useMeetingStore.setState({ meetings: [], activeMeetingId: null });
    for (const id of ["w1", "w2", "w3", "w4"]) movement.unregister(id);
    seedAgents();
  });

  it("starts a wander for an idle agent (max 2 concurrent)", () => {
    _wanderTickForTests();
    const walking = ["w1", "w2", "w3"].filter((id) => movement.isMoving(id));
    expect(walking.length).toBeGreaterThanOrEqual(1);
    expect(walking.length).toBeLessThanOrEqual(2);
    // The working agent never wanders.
    expect(movement.isMoving("w4")).toBe(false);
  });

  it("never sends more than 2 wanderers even with many idle agents", () => {
    for (let i = 0; i < 20; i++) _wanderTickForTests();
    const walking = ["w1", "w2", "w3"].filter((id) => movement.isMoving(id));
    expect(walking.length).toBeLessThanOrEqual(2);
  });

  it("does not interrupt meeting participants", () => {
    useMeetingStore.setState({
      meetings: [
        {
          id: "m1",
          topic: "T",
          participantIds: ["w1"],
          seats: { w1: 0 },
          phase: "toMeeting",
          arrivedIds: [],
          transcript: [],
          minutes: null,
          startedAt: new Date().toISOString(),
          endedAt: null,
        },
      ],
      activeMeetingId: "m1",
    });
    for (let i = 0; i < 10; i++) _wanderTickForTests();
    // w1 is in a meeting → should not be sent wandering.
    expect(movement.isMoving("w1")).toBe(false);
  });
});
