import { describe, expect, it } from "vitest";
import {
  AGENT_FACING,
  AGENT_SPAWN_POSITION,
  PM_HOME,
} from "./layout";

describe("project workstation home (Difia PM)", () => {
  it("spawns exactly on the Project Room boss chair, facing south", () => {
    expect(PM_HOME).toEqual({ x: -11.5, z: 4.8, facing: 0 });
    expect(AGENT_SPAWN_POSITION("project")).toEqual([-11.5, 0, 4.8]);
    expect(AGENT_FACING("project")).toBe(0);
  });

  it("does not route the PM through workspace desk-chair logic", () => {
    // Workspace desks put the chair south of the desk (z + 0.95) and
    // face north; the boss chair is north of its desk and faces south,
    // so a desk-slot answer would put Difia on the wrong side of the
    // table. The project home must be the boss chair itself.
    const [x, , z] = AGENT_SPAWN_POSITION("project");
    expect(z).toBeLessThan(5.5); // boss desk center, not south of it
    expect(x).toBe(-11.5);
  });

  it("keeps workspace desks on their existing chair/facing rules", () => {
    const [x, , z] = AGENT_SPAWN_POSITION("ws-01");
    expect(x).toBe(-4);
    expect(z).toBeCloseTo(-1.3 + 0.95, 5);
    expect(AGENT_FACING("ws-01")).toBe(Math.PI);
  });

  it("keeps the lobby-grid fallback for unknown workstations", () => {
    const [x, , z] = AGENT_SPAWN_POSITION("ws-remote");
    expect(x).toBeGreaterThanOrEqual(-4);
    expect(z).toBeGreaterThanOrEqual(7);
    expect(AGENT_FACING("ws-remote")).toBe(0);
  });
});
