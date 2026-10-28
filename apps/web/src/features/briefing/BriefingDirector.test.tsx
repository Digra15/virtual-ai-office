import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BRIEF_GUEST_CHAIR,
  GUEST_BRIEFING_STRIP_TEXT,
  _briefingTickForTests,
  _endBriefingTalkForTests,
  _resetBriefingForTests,
} from "./BriefingDirector";
import { useAgentStore } from "../../stores/useAgentStore";
import { useMeetingStore } from "../../stores/useMeetingStore";
import { usePresenceStore } from "../../stores/usePresenceStore";
import { useTaskStore } from "../../stores/useTaskStore";
import { useBriefingStore } from "../../stores/useBriefingStore";
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
    mk("difia", "project"),
    mk("nayla", "reception"),
    mk("kirana", "ws-01"),
    mk("reno", "ws-02"),
  ]);
}

function walkAll(maxSteps = 2000): void {
  // Small steps so sampled positions approximate the continuous path
  // (a table clip would be sampled, not jumped over).
  for (let i = 0; i < maxSteps; i++) {
    if (!movement.isMoving("difia") && !movement.isMoving("kirana")) break;
    movement.update(0.1);
  }
}

function insideTable(x: number, z: number): boolean {
  return x > -12.4 && x < -10.6 && z > 5.05 && z < 5.95;
}

describe("briefing director (Project Room)", () => {
  beforeEach(() => {
    _resetBriefingForTests();
    usePresenceStore.setState({ presences: {} });
    useMeetingStore.setState({ meetings: [], activeMeetingId: null });
    useTaskStore.setState({ tasks: [] });
    useGuestPresenceStore.setState({
      guestActive: false,
      briefingActive: false,
      remoteActive: null,
      remoteUnavailable: false,
      localActive: false,
      briefingUnavailable: false,
    });
    for (const id of ["difia", "nayla", "kirana", "reno"]) {
      movement.unregister(id);
    }
    seedAgents();
    movement.register("difia", mockGroup(), -11.5, 4.8, 0);
    movement.register("nayla", mockGroup(), -4, 6.7, 0);
    movement.register("kirana", mockGroup(), -4, -0.35, Math.PI);
    movement.register("reno", mockGroup(), -2, -0.35, Math.PI);
  });

  it("walks a worker to the guest chair, seats Difia PM, and talks with real text", () => {
    useBriefingStore.getState().startBriefing({
      id: "brief-1",
      visitorId: "kirana",
      text: "Tulis artikel X",
      kind: "instruction",
    });
    _briefingTickForTests();
    let clipped = false;
    for (let i = 0; i < 2000; i++) {
      if (!movement.isMoving("kirana")) break;
      movement.update(0.1);
      const pos = movement.getPosition("kirana");
      if (pos && insideTable(pos.x, pos.z)) clipped = true;
    }
    expect(clipped).toBe(false);
    expect(movement.isMoving("kirana")).toBe(false);
    const pos = movement.getPosition("kirana");
    expect(pos).not.toBeNull();
    expect(
      Math.hypot(
        (pos as { x: number; z: number }).x - BRIEF_GUEST_CHAIR.x,
        (pos as { x: number; z: number }).z - BRIEF_GUEST_CHAIR.z,
      ),
    ).toBeLessThanOrEqual(0.5);
    expect(usePresenceStore.getState().presences["kirana"]?.pose).toBe("desk");
    // Instruction briefing: the PM speaks, the worker listens.
    expect(useBriefingStore.getState().speakerId).toBe("difia");
    expect(useBriefingStore.getState().briefing?.text).toBe("Tulis artikel X");
    // PM stays seated in the boss chair.
    const pmPos = movement.getPosition("difia");
    expect(pmPos).not.toBeNull();
    expect(Math.hypot((pmPos as { x: number; z: number }).x + 11.5, (pmPos as { x: number; z: number }).z - 4.8)).toBeLessThanOrEqual(0.5);
  });

  it("walks the PM to the boss chair first when she is not there yet", () => {
    movement.unregister("difia");
    movement.register("difia", mockGroup(), 0, 8.6, 0);
    useBriefingStore.getState().startBriefing({
      id: "brief-2",
      visitorId: "kirana",
      text: "Tulis artikel Y",
      kind: "instruction",
    });
    _briefingTickForTests();
    walkAll();
    const pmPos = movement.getPosition("difia");
    expect(pmPos).not.toBeNull();
    expect(Math.hypot((pmPos as { x: number; z: number }).x + 11.5, (pmPos as { x: number; z: number }).z - 4.8)).toBeLessThanOrEqual(0.5);
    expect(useBriefingStore.getState().speakerId).toBe("difia");
  });

  it("returns the visitor home when talking ends", () => {
    useBriefingStore.getState().startBriefing({
      id: "brief-3",
      visitorId: "kirana",
      text: "Tulis artikel Z",
      kind: "instruction",
    });
    _briefingTickForTests();
    walkAll();
    expect(useBriefingStore.getState().speakerId).toBe("difia");
    _endBriefingTalkForTests();
    expect(useBriefingStore.getState().briefing).toBeNull();
    expect(useBriefingStore.getState().speakerId).toBeNull();
    walkAll();
    const pos = movement.getPosition("kirana");
    expect(pos).not.toBeNull();
    // Back at the ws-01 chair (south of the ws-01 desk).
    expect(Math.hypot((pos as { x: number; z: number }).x + 4, (pos as { x: number; z: number }).z + 0.35)).toBeLessThanOrEqual(0.5);
  });

  it("starts a briefing from a Kanban task added after mount", () => {
    _briefingTickForTests(); // snapshots the (empty) initial task list
    const task = useTaskStore.getState().addTask("Rangkuman berita", "reno");
    _briefingTickForTests();
    const briefing = useBriefingStore.getState().briefing;
    expect(briefing?.visitorId).toBe("reno");
    expect(briefing?.text).toBe("Rangkuman berita");
    expect(briefing?.kind).toBe("instruction");
    expect(briefing?.id).toBe(task.id);
  });

  it("does not brief Difia's own tasks or tasks that predate mount", () => {
    const pre = useTaskStore.getState().addTask("Tugas lama PM", "difia");
    expect(pre).toBeDefined();
    _briefingTickForTests(); // snapshots, including the pre-existing task
    _briefingTickForTests();
    expect(useBriefingStore.getState().briefing).toBeNull();
  });

  it("starts a guest-order report briefing from the signal only when the guest is quiet", () => {
    useGuestPresenceStore.setState({ briefingActive: true, guestActive: false });
    _briefingTickForTests(); // creates the briefing (flow starts on the next tick)
    _briefingTickForTests(); // starts the flow: Nayla walks to the guest chair
    const briefing = useBriefingStore.getState().briefing;
    expect(briefing?.visitorId).toBe("nayla");
    expect(briefing?.kind).toBe("report");
    // No guest content in the briefing: the strip caption is generic.
    expect(briefing?.text).toBe("");
    expect(GUEST_BRIEFING_STRIP_TEXT).toBe("Membahas pesanan tamu");
    // Walk Nayla from the reception chair to the guest chair.
    for (let i = 0; i < 2000; i++) {
      if (!movement.isMoving("nayla") && !movement.isMoving("difia")) break;
      movement.update(0.1);
    }
    expect(movement.isMoving("nayla")).toBe(false);
    const pos = movement.getPosition("nayla");
    expect(pos).not.toBeNull();
    expect(
      Math.hypot(
        (pos as { x: number; z: number }).x - BRIEF_GUEST_CHAIR.x,
        (pos as { x: number; z: number }).z - BRIEF_GUEST_CHAIR.z,
      ),
    ).toBeLessThanOrEqual(0.5);
    // Report briefing: the visitor (Nayla) speaks, the PM listens.
    expect(useBriefingStore.getState().speakerId).toBe("nayla");
  });

  it("does not start a signal briefing while the guest is still active", () => {
    useGuestPresenceStore.setState({ briefingActive: true, guestActive: true });
    _briefingTickForTests();
    expect(useBriefingStore.getState().briefing).toBeNull();
    // Once the guest goes quiet, the same signal starts it.
    useGuestPresenceStore.setState({ guestActive: false });
    _briefingTickForTests();
    expect(useBriefingStore.getState().briefing?.visitorId).toBe("nayla");
  });

  it("does not restart a finished signal briefing until the signal clears", () => {
    useGuestPresenceStore.setState({ briefingActive: true, guestActive: false });
    _briefingTickForTests(); // creates the briefing
    _briefingTickForTests(); // starts the flow
    for (let i = 0; i < 2000; i++) {
      if (!movement.isMoving("nayla") && !movement.isMoving("difia")) break;
      movement.update(0.1);
    }
    expect(useBriefingStore.getState().speakerId).toBe("nayla");
    _endBriefingTalkForTests();
    expect(useBriefingStore.getState().briefing).toBeNull();
    // Signal still on: no restart.
    _briefingTickForTests();
    expect(useBriefingStore.getState().briefing).toBeNull();
    // Signal clears, then rises again: a new episode may brief.
    useGuestPresenceStore.setState({ briefingActive: false });
    _briefingTickForTests();
    useGuestPresenceStore.setState({ briefingActive: true });
    _briefingTickForTests();
    expect(useBriefingStore.getState().briefing?.visitorId).toBe("nayla");
  });

  it("leaves Nayla in place after a report briefing instead of routing her home", () => {
    useGuestPresenceStore.setState({ briefingActive: true, guestActive: false });
    _briefingTickForTests(); // creates the briefing
    _briefingTickForTests(); // starts the flow
    for (let i = 0; i < 2000; i++) {
      if (!movement.isMoving("nayla") && !movement.isMoving("difia")) break;
      movement.update(0.1);
    }
    _endBriefingTalkForTests();
    expect(movement.isMoving("nayla")).toBe(false);
    const pos = movement.getPosition("nayla");
    expect(pos).not.toBeNull();
    expect(
      Math.hypot(
        (pos as { x: number; z: number }).x - BRIEF_GUEST_CHAIR.x,
        (pos as { x: number; z: number }).z - BRIEF_GUEST_CHAIR.z,
      ),
    ).toBeLessThanOrEqual(0.5);
  });

  it("keeps an empty strip text empty — never invents dialogue", () => {
    useBriefingStore.getState().startBriefing({
      id: "brief-4",
      visitorId: "kirana",
      text: "",
      kind: "instruction",
    });
    expect(useBriefingStore.getState().briefing?.text).toBe("");
  });
});
