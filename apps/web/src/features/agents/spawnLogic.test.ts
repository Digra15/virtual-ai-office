import { describe, expect, it } from "vitest";
import { nextSpawnWorkstationId } from "./spawnLogic";

describe("spawn workstation id allocation", () => {
  it("returns a virtual id namespaced per agent", () => {
    expect(nextSpawnWorkstationId("agent-abc123")).toBe("spawn-agent-abc123");
  });

  it("is unique per agent id", () => {
    const a = nextSpawnWorkstationId("agent-1");
    const b = nextSpawnWorkstationId("agent-2");
    expect(a).not.toBe(b);
    expect(a).toBe("spawn-agent-1");
    expect(b).toBe("spawn-agent-2");
  });

  it("never collides with the 8 physical workstations", () => {
    for (let i = 1; i <= 8; i++) {
      const ws = `ws-0${i}`;
      expect(nextSpawnWorkstationId(ws)).not.toBe(ws);
    }
  });
});
