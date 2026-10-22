import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMeetingStore } from "./useMeetingStore";
import { useAgentStore } from "./useAgentStore";
import { movement } from "../world/movement";
import { usePresenceStore } from "./usePresenceStore";
import type { AgentInfo } from "@virtual-ai-office/shared";

function mockGroup() {
  return {
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    rotation: { set: vi.fn() },
  } as unknown as import("three").Group;
}

function seedAgents(): void {
  const mk = (id: string, name: string, role: string): AgentInfo => ({
    id,
    name,
    role,
    status: "idle",
    currentTask: "Awaiting assignment",
    progress: null,
    lastSeen: new Date().toISOString(),
    workstationId: "ws-01",
    activityHistory: [],
    source: "demo",
  });
  useAgentStore.getState().applySnapshot([
    mk("a1", "Ava", "Research Agent"),
    mk("a2", "Ben", "Coding Agent"),
    mk("a3", "Cy", "Design Agent"),
  ]);
  for (const id of ["a1", "a2", "a3"]) {
    movement.register(id, mockGroup(), -7.5, -1.5, 0);
  }
}

function resetAll(): void {
  useMeetingStore.setState({ meetings: [], activeMeetingId: null });
  usePresenceStore.setState({ presences: {} });
  for (const id of ["a1", "a2", "a3"]) movement.unregister(id);
}

describe("meeting store", () => {
  beforeEach(() => {
    resetAll();
    seedAgents();
  });

  it("rejects invalid meeting setups", () => {
    expect(() => useMeetingStore.getState().startMeeting(["a1"], "Topic")).toThrow(
      /at least 2/,
    );
    expect(() =>
      useMeetingStore.getState().startMeeting(["a1", "a2"], "   "),
    ).toThrow(/topic/i);
    expect(() =>
      useMeetingStore.getState().startMeeting(["a1", "a2", "a3", "a1", "a2"], "T"),
    ).not.toThrow(); // dedupes to 3
    resetAll();
    seedAgents();
    expect(() =>
      useMeetingStore.getState().startMeeting(["a1", "ghost"], "T"),
    ).toThrow(/unknown agent/i);
  });

  it("starts a meeting: invites on the A2A transcript, agents walk", () => {
    useMeetingStore.getState().startMeeting(["a1", "a2"], "Q4 planning");
    const st = useMeetingStore.getState();
    expect(st.activeMeetingId).not.toBeNull();
    const m = st.meetings[0];
    expect(m.phase).toBe("toMeeting");
    expect(m.participantIds).toEqual(["a1", "a2"]);
    // Two invites recorded.
    const invites = m.transcript.filter((t) => t.type === "meeting.invite");
    expect(invites).toHaveLength(2);
    expect(invites[0].payload).toMatchObject({ topic: "Q4 planning" });
    // Agents are walking.
    expect(movement.isMoving("a1")).toBe(true);
    expect(movement.isMoving("a2")).toBe(true);
    expect(usePresenceStore.getState().presences["a1"]?.activity).toBe("walking");
  });

  it("generates simulated turns + minutes once everyone arrives", () => {
    useMeetingStore.getState().startMeeting(["a1", "a2"], "Launch plan");
    // Fast-forward the walkers.
    for (let i = 0; i < 500; i++) {
      movement.update(0.5);
      const m = useMeetingStore.getState().meetings[0];
      if (m.phase === "active") break;
    }
    const m = useMeetingStore.getState().meetings[0];
    expect(m.phase).toBe("active");
    expect(m.arrivedIds.sort()).toEqual(["a1", "a2"]);
    const turns = m.transcript.filter((t) => t.type === "meeting.turn");
    expect(turns.length).toBe(4); // 2 participants × 2 rounds
    expect(turns[0].payload).toMatchObject({ simulated: true });
    const minutes = m.transcript.filter((t) => t.type === "meeting.minutes");
    expect(minutes).toHaveLength(1);
    expect(m.minutes).toContain("Action items");
    // Seated in meeting pose.
    expect(usePresenceStore.getState().presences["a1"]).toEqual({
      activity: "meeting",
      pose: "free",
    });
  });

  it("endMeeting archives and walks agents home", () => {
    useMeetingStore.getState().startMeeting(["a1", "a2"], "Retro");
    useMeetingStore.getState().endMeeting();
    const st = useMeetingStore.getState();
    expect(st.activeMeetingId).toBeNull();
    expect(st.meetings[0].phase).toBe("done");
    expect(st.meetings[0].endedAt).not.toBeNull();
    // Walking home.
    expect(movement.isMoving("a1")).toBe(true);
  });

  it("dismissMeeting removes it", () => {
    useMeetingStore.getState().startMeeting(["a1", "a2"], "Sync");
    const id = useMeetingStore.getState().meetings[0].id;
    useMeetingStore.getState().dismissMeeting(id);
    expect(useMeetingStore.getState().meetings).toHaveLength(0);
  });
});
