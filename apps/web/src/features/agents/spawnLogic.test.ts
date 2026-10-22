import { describe, expect, it } from "vitest";
import { findFreeWorkstation } from "./spawnLogic";
import type { AgentInfo } from "@virtual-ai-office/shared";

function mkAgent(id: string, workstationId: string): AgentInfo {
  return {
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
  };
}

describe("spawn workstation allocation", () => {
  it("returns the first free overflow desk", () => {
    const agents = {
      a: mkAgent("a", "stress-01"),
      b: mkAgent("b", "stress-02"),
    };
    // stress-01/02 taken → next free is stress-03.
    expect(findFreeWorkstation(agents)).toBe("stress-03");
  });

  it("ignores agents at the main desks", () => {
    const agents = { a: mkAgent("a", "ws-01") };
    expect(findFreeWorkstation(agents)).toBe("stress-01");
  });

  it("returns null when all 22 overflow desks are taken", () => {
    const agents: Record<string, AgentInfo> = {};
    for (let i = 1; i <= 22; i++) {
      const ws = `stress-${String(i).padStart(2, "0")}`;
      agents[`a${i}`] = mkAgent(`a${i}`, ws);
    }
    expect(findFreeWorkstation(agents)).toBeNull();
  });

  it("returns the first desk when the roster is empty", () => {
    expect(findFreeWorkstation({})).toBe("stress-01");
  });
});
