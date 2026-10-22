import { beforeEach, describe, expect, it } from "vitest";
import type {
  ActivityEntry,
  AgentInfo,
  AgentStatus,
} from "@virtual-ai-office/shared";
import { useAgentStore } from "./useAgentStore";

function makeAgent(over: Partial<AgentInfo> & { id: string }): AgentInfo {
  return {
    name: over.id,
    role: "Test role",
    status: "idle",
    currentTask: "",
    progress: null,
    lastSeen: new Date("2026-10-22T12:00:00.000Z").toISOString(),
    workstationId: "ws-01",
    activityHistory: [],
    source: "demo",
    ...over,
  };
}

function makeEntry(agentId: string, n: number): ActivityEntry {
  return {
    id: `e-${n}`,
    agentId,
    timestamp: new Date(Date.UTC(2026, 9, 22, 12, 0, n)).toISOString(),
    kind: "note" as unknown as ActivityEntry["kind"],
    message: `event ${n}`,
  };
}

beforeEach(() => {
  useAgentStore.setState({ agents: {}, selectedId: null, globalEvents: [] });
});

describe("useAgentStore", () => {
  it("applySnapshot replaces agents and computes stats (online excludes offline)", () => {
    useAgentStore.getState().applySnapshot([
      makeAgent({ id: "a", status: "working" }),
      makeAgent({ id: "b", status: "working" }),
      makeAgent({ id: "c", status: "error" }),
      makeAgent({ id: "d", status: "offline" }),
    ]);
    expect(useAgentStore.getState().selectStats()).toEqual({
      total: 4,
      online: 3,
      working: 2,
      errors: 1,
    });
  });

  it("applyUpdate replaces a single agent", () => {
    useAgentStore.getState().applySnapshot([makeAgent({ id: "a", status: "idle" })]);
    useAgentStore
      .getState()
      .applyUpdate(makeAgent({ id: "a", status: "working" }));
    expect(useAgentStore.getState().agents["a"].status).toBe("working");
  });

  it("selectFiltered filters by search text across name/role/task", () => {
    useAgentStore.getState().applySnapshot([
      makeAgent({ id: "n1", name: "Nika", role: "Personal Assistant" }),
      makeAgent({
        id: "c1",
        name: "Coding",
        role: "Coding Agent",
        currentTask: "Fixing websocket bugs",
      }),
      makeAgent({ id: "d1", name: "Data", role: "Data Analyst" }),
    ]);
    const s = useAgentStore.getState();
    expect(s.selectFiltered("nika", "all").map((a) => a.id)).toEqual(["n1"]);
    expect(s.selectFiltered("assistant", "all").map((a) => a.id)).toEqual(["n1"]);
    expect(s.selectFiltered("websocket", "all").map((a) => a.id)).toEqual(["c1"]);
    expect(s.selectFiltered("", "all")).toHaveLength(3);
  });

  it("selectFiltered filters by status", () => {
    useAgentStore.getState().applySnapshot([
      makeAgent({ id: "a", status: "working" as AgentStatus }),
      makeAgent({ id: "b", status: "error" as AgentStatus }),
      makeAgent({ id: "c", status: "idle" as AgentStatus }),
    ]);
    const s = useAgentStore.getState();
    expect(s.selectFiltered("", "working").map((a) => a.id)).toEqual(["a"]);
    expect(s.selectFiltered("", "error").map((a) => a.id)).toEqual(["b"]);
    // search and status filter combine
    expect(s.selectFiltered("b", "error").map((a) => a.id)).toEqual(["b"]);
    expect(s.selectFiltered("b", "working")).toHaveLength(0);
  });

  it("appendEvent prepends newest, patches agent history, caps globalEvents at 100", () => {
    const store = useAgentStore.getState();
    store.applySnapshot([makeAgent({ id: "a" })]);
    for (let n = 0; n < 105; n++) {
      useAgentStore.getState().appendEvent("a", makeEntry("a", n));
    }
    const s = useAgentStore.getState();
    expect(s.globalEvents).toHaveLength(100);
    expect(s.globalEvents[0].id).toBe("e-104"); // newest first
    expect(s.globalEvents[99].id).toBe("e-5");
    // agent history keeps everything, newest first
    expect(s.agents["a"].activityHistory).toHaveLength(105);
    expect(s.agents["a"].activityHistory[0].id).toBe("e-104");
  });

  it("select sets and clears the selection", () => {
    const s = useAgentStore.getState();
    s.select("a");
    expect(useAgentStore.getState().selectedId).toBe("a");
    s.select(null);
    expect(useAgentStore.getState().selectedId).toBeNull();
  });

  it("upsertLocal / removeLocal manage extra agents", () => {
    const s = useAgentStore.getState();
    s.upsertLocal(makeAgent({ id: "x1", name: "Extra" }));
    expect(useAgentStore.getState().agents["x1"].name).toBe("Extra");
    s.select("x1");
    s.removeLocal("x1");
    expect(useAgentStore.getState().agents["x1"]).toBeUndefined();
    expect(useAgentStore.getState().selectedId).toBeNull();
  });
});
