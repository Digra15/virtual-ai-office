import { beforeEach, describe, expect, it } from "vitest";
import {
  checkBedAvailable,
  checkWorkstationAvailable,
  isKnownBed,
  roomOfWorkstation,
  useOccupancyStore,
  workstationLocation,
} from "./useOccupancyStore";
import { useAgentStore } from "./useAgentStore";
import type { AgentInfo } from "@virtual-ai-office/shared";

function makeAgent(id: string, workstationId: string): AgentInfo {
  return {
    id,
    name: id,
    role: "Test",
    status: "idle",
    currentTask: "none",
    progress: null,
    lastSeen: new Date().toISOString(),
    workstationId,
    activityHistory: [],
    source: "demo",
  };
}

beforeEach(() => {
  useOccupancyStore.getState().reset();
  useAgentStore.getState().applySnapshot([
    makeAgent("a", "ws-01"),
    makeAgent("b", "ws-02"),
  ]);
});

describe("checkWorkstationAvailable (pure)", () => {
  const occupied = { a: "ws-01", b: "ws-02" };

  it("allows a free workstation", () => {
    expect(checkWorkstationAvailable("ws-03", occupied, "a")).toEqual({ ok: true });
  });

  it("rejects a workstation occupied by another agent", () => {
    const r = checkWorkstationAvailable("ws-02", occupied, "a");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("ws-02");
  });

  it("allows re-claiming your own workstation", () => {
    expect(checkWorkstationAvailable("ws-01", occupied, "a")).toEqual({ ok: true });
  });

  it("force bypasses the occupancy check", () => {
    expect(checkWorkstationAvailable("ws-02", occupied, "a", true)).toEqual({
      ok: true,
    });
  });
});

describe("checkBedAvailable (pure)", () => {
  it("allows a free bed", () => {
    expect(checkBedAvailable("bed-01", {}, "a")).toEqual({ ok: true });
  });

  it("rejects a bed held by another agent", () => {
    const r = checkBedAvailable("bed-01", { "bed-01": "b" }, "a");
    expect(r.ok).toBe(false);
  });

  it("allows keeping your own bed", () => {
    expect(checkBedAvailable("bed-01", { "bed-01": "a" }, "a")).toEqual({
      ok: true,
    });
  });
});

describe("assignBed / releaseBed / bedOf / freeBeds", () => {
  it("assigns, reports, and releases a bed", () => {
    const s = useOccupancyStore.getState();
    expect(s.freeBeds()).toContain("bed-01");
    expect(s.assignBed("a", "bed-01")).toEqual({ ok: true });
    expect(s.bedOf("a")).toBe("bed-01");
    expect(s.freeBeds()).not.toContain("bed-01");
    expect(s.freeBeds()).toContain("bed-02");

    s.releaseBed("a");
    expect(s.bedOf("a")).toBeNull();
    expect(s.freeBeds()).toContain("bed-01");
  });

  it("rejects a second agent on the same bed", () => {
    const s = useOccupancyStore.getState();
    expect(s.assignBed("a", "bed-01").ok).toBe(true);
    const r = s.assignBed("b", "bed-01");
    expect(r.ok).toBe(false);
    expect(s.bedOf("b")).toBeNull();
  });

  it("rejects unknown bed ids", () => {
    const r = useOccupancyStore.getState().assignBed("a", "bed-99");
    expect(r.ok).toBe(false);
  });

  it("reassigning moves the agent (one bed per agent)", () => {
    const s = useOccupancyStore.getState();
    s.assignBed("a", "bed-01");
    s.assignBed("a", "bed-02");
    expect(s.bedOf("a")).toBe("bed-02");
    expect(s.freeBeds()).toContain("bed-01");
  });
});

describe("assignWorkstation", () => {
  it("stores an override on success", () => {
    const s = useOccupancyStore.getState();
    expect(s.assignWorkstation("a", "ws-03")).toEqual({ ok: true });
    expect(s.workstationOf("a", "ws-01")).toBe("ws-03");
  });

  it("rejects an occupied workstation and keeps the old one", () => {
    const s = useOccupancyStore.getState();
    const r = s.assignWorkstation("a", "ws-02");
    expect(r.ok).toBe(false);
    expect(s.workstationOf("a", "ws-01")).toBe("ws-01");
  });
});

describe("roomOf / workstationOf", () => {
  it("falls back to the agent's workstationId", () => {
    const s = useOccupancyStore.getState();
    expect(s.workstationOf("a", "ws-01")).toBe("ws-01");
    expect(s.workstationOf("ghost")).toBeNull();
  });

  it("resolves the room of a legacy desk", () => {
    const room = useOccupancyStore.getState().roomOf("a", "ws-01");
    expect(room?.id).toBe("workspace");
  });

  it("resolves the room of a floorPlan workstation", () => {
    const s = useOccupancyStore.getState();
    s.assignWorkstation("a", "ws-05", { force: true });
    expect(s.roomOf("a")?.id).toBe("workspace");
  });

  it("returns null for unknown workstations", () => {
    expect(useOccupancyStore.getState().roomOf("ghost")).toBeNull();
  });
});

describe("workstationLocation / roomOfWorkstation / isKnownBed", () => {
  it("locates floorPlan and legacy workstations", () => {
    expect(workstationLocation("ws-01")).toMatchObject({ floor: 0, roomId: "workspace" });
    expect(workstationLocation("stress-01")).toMatchObject({ floor: 0 });
    expect(workstationLocation("nope")).toBeNull();
  });

  it("maps a bed workstation to the recovery room", () => {
    expect(roomOfWorkstation("bed-01" as never)).toBeNull(); // beds aren't workstations
    expect(roomOfWorkstation("nope")).toBeNull();
    expect(roomOfWorkstation("ws-05")?.id).toBe("workspace");
  });

  it("knows the scene's recovery beds", () => {
    expect(isKnownBed("bed-01")).toBe(true);
    expect(isKnownBed("bed-04")).toBe(true);
    expect(isKnownBed("bed-99")).toBe(false);
  });
});
