import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentInfo, AgentStatus } from "@virtual-ai-office/shared";
import {
  HEALTHY_STATUSES,
  canMarkResolved,
  findFreeBed,
  isHealthyStatus,
  markResolved,
  recoveryTarget,
  resolveError,
  returnToWorkstation,
  sendToRecovery,
  shouldAutoRecover,
  simulateError,
} from "./recoveryLogic";
import { RECOVERY_BEDS } from "../../world/building/floorPlan";
import { movement } from "../../world/movement";
import { useAgentStore } from "../../stores/useAgentStore";
import { useOccupancyStore } from "../../stores/useOccupancyStore";
import { usePresenceStore } from "../../stores/usePresenceStore";

function makeAgent(id: string, status: AgentStatus): AgentInfo {
  return {
    id,
    name: id,
    role: "Test",
    status,
    currentTask: "none",
    progress: null,
    lastSeen: new Date().toISOString(),
    workstationId: "ws-01",
    activityHistory: [],
    source: "demo",
  };
}

function mockGroup() {
  return {
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    rotation: { set: vi.fn() },
  } as unknown as import("three").Group;
}

beforeEach(() => {
  useOccupancyStore.getState().reset();
  usePresenceStore.setState({ presences: {} });
  for (const id of ["r1", "r2", "r3"]) {
    try {
      movement.unregister(id);
    } catch {
      /* noop */
    }
  }
  useAgentStore.getState().applySnapshot([
    makeAgent("r1", "error"),
    makeAgent("r2", "idle"),
    makeAgent("r3", "working"),
  ]);
  // r1 starts at its desk; r2/r3 unregistered (no scene presence).
  movement.register("r1", mockGroup(), -7.5, -1.5, 0);
});

describe("findFreeBed", () => {
  it("returns the first unassigned bed", () => {
    const bed = findFreeBed(RECOVERY_BEDS, {});
    expect(bed?.id).toBe("bed-01");
  });

  it("skips occupied beds", () => {
    const bed = findFreeBed(RECOVERY_BEDS, { "bed-01": "x", "bed-02": "y" });
    expect(bed?.id).toBe("bed-03");
  });

  it("returns null when the room is full", () => {
    const assignments = Object.fromEntries(
      RECOVERY_BEDS.map((b, i) => [b.id, `agent-${i}`]),
    );
    expect(findFreeBed(RECOVERY_BEDS, assignments)).toBeNull();
  });
});

describe("shouldAutoRecover", () => {
  const base = {
    enabled: true,
    autoRecover: true,
    hasBed: false,
    isMoving: false,
  };

  it("fires only for status 'error'", () => {
    expect(shouldAutoRecover({ ...base, status: "error" })).toBe(true);
  });

  it("NEVER fires for idle/waiting/offline/meeting/recovering", () => {
    for (const status of [
      "idle",
      "waiting",
      "offline",
      "meeting",
      "recovering",
      "working",
      "thinking",
    ] as AgentStatus[]) {
      expect(
        shouldAutoRecover({ ...base, status }),
        `should not auto-recover ${status}`,
      ).toBe(false);
    }
  });

  it("respects the config switches, bed state, and in-flight movement", () => {
    expect(shouldAutoRecover({ ...base, status: "error", enabled: false })).toBe(false);
    expect(shouldAutoRecover({ ...base, status: "error", autoRecover: false })).toBe(false);
    expect(shouldAutoRecover({ ...base, status: "error", hasBed: true })).toBe(false);
    expect(shouldAutoRecover({ ...base, status: "error", isMoving: true })).toBe(false);
  });
});

describe("recoveryTarget", () => {
  it("targets the bed position on the second floor (Ruang Pemulihan)", () => {
    const target = recoveryTarget(RECOVERY_BEDS[0]!);
    expect(target).toEqual({
      x: RECOVERY_BEDS[0]!.position[0],
      z: RECOVERY_BEDS[0]!.position[2],
      floor: 1,
    });
  });
});

describe("isHealthyStatus / canMarkResolved", () => {
  it("treats working/idle/thinking/meeting/waiting as healthy", () => {
    expect(HEALTHY_STATUSES).toEqual(
      expect.arrayContaining(["working", "idle", "thinking", "meeting", "waiting"]),
    );
    for (const s of HEALTHY_STATUSES) expect(isHealthyStatus(s)).toBe(true);
    expect(isHealthyStatus("error")).toBe(false);
    expect(isHealthyStatus("recovering")).toBe(false);
    expect(isHealthyStatus("offline")).toBe(false);
  });

  it("allows manual resolution only from error/recovering", () => {
    expect(canMarkResolved("error")).toBe(true);
    expect(canMarkResolved("recovering")).toBe(true);
    expect(canMarkResolved("idle")).toBe(false);
    expect(canMarkResolved("working")).toBe(false);
  });
});

describe("simulateError / resolveError (SIMULATED hooks)", () => {
  it("simulateError flips the agent to error and logs a SIMULATED event", () => {
    simulateError("r2", "network", "synthetic outage");
    const agent = useAgentStore.getState().agents["r2"];
    expect(agent?.status).toBe("error");
    expect(agent?.activityHistory[0]?.message).toContain("SIMULATED");
    expect(agent?.activityHistory[0]?.message).toContain("network");
  });

  it("simulateError ignores unknown agents", () => {
    expect(() => simulateError("ghost")).not.toThrow();
  });

  it("resolveError flips the agent back to idle with a SIMULATED event", () => {
    simulateError("r2");
    resolveError("r2");
    const agent = useAgentStore.getState().agents["r2"];
    expect(agent?.status).toBe("idle");
    expect(agent?.activityHistory[0]?.message).toContain("SIMULATED");
  });
});

describe("sendToRecovery", () => {
  it("walks the agent to a bed and assigns it", () => {
    const res = sendToRecovery("r1");
    expect(res).toEqual({ ok: true, bedId: "bed-01" });
    expect(useOccupancyStore.getState().bedOf("r1")).toBe("bed-01");
    expect(movement.isMoving("r1")).toBe(true);
  });

  it("refuses a second dispatch while the agent holds a bed", () => {
    sendToRecovery("r1");
    const res = sendToRecovery("r1");
    expect(res.ok).toBe(false);
  });

  it("fails honestly when the agent is not registered (no bed assigned)", () => {
    const res = sendToRecovery("r2"); // r2 never registered with movement
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("transit");
    expect(useOccupancyStore.getState().bedOf("r2")).toBeNull();
  });

  it("fails honestly when the room is full", () => {
    const occ = useOccupancyStore.getState();
    RECOVERY_BEDS.forEach((b, i) => occ.assignBed(`other-${i}`, b.id));
    const res = sendToRecovery("r1");
    expect(res).toEqual({ ok: false, reason: "Recovery room is full" });
  });
});

describe("returnToWorkstation", () => {
  it("walks a healthy bed-holder back and releases the bed", () => {
    const occ = useOccupancyStore.getState();
    occ.assignBed("r1", "bed-01");
    // r1 is 'error' in the seed — flip to healthy first.
    useAgentStore
      .getState()
      .applyUpdate({ ...useAgentStore.getState().agents["r1"]!, status: "idle" });
    expect(returnToWorkstation("r1")).toBe(true);
    expect(occ.bedOf("r1")).toBeNull();
    expect(movement.isMoving("r1")).toBe(true);
  });

  it("returns false when the agent is not registered", () => {
    expect(returnToWorkstation("r2")).toBe(false);
  });
});

describe("markResolved (manual action)", () => {
  it("flips to idle and logs a manual-action event", () => {
    markResolved("r1");
    const agent = useAgentStore.getState().agents["r1"];
    expect(agent?.status).toBe("idle");
    expect(agent?.activityHistory[0]?.message).toContain("manual action");
  });
});
