import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentInfo } from "@virtual-ai-office/shared";
import { useAgentStore } from "../../stores/useAgentStore";
import { useCameraStore } from "../../stores/useCameraStore";
import { AGENT_SPAWN_POSITION } from "../layout";
import { makeAgentClickHandler, selectAgentFromScene } from "./selectAgent";

function makeAgent(id: string, workstationId: string): AgentInfo {
  return {
    id,
    name: id,
    role: "Test role",
    status: "idle",
    currentTask: "testing",
    progress: null,
    lastSeen: new Date("2026-10-22T12:00:00.000Z").toISOString(),
    workstationId,
    activityHistory: [],
    source: "demo",
  };
}

beforeEach(() => {
  useAgentStore.setState({ agents: {}, selectedId: null, globalEvents: [] });
  useCameraStore.setState({ focusRequest: null, resetNonce: 0 });
});

describe("selectAgentFromScene", () => {
  it("selects the agent and requests a camera focus at its desk", () => {
    useAgentStore
      .getState()
      .applySnapshot([
        makeAgent("nika", "ws-01"),
        makeAgent("coder", "ws-02"),
      ]);

    selectAgentFromScene("coder", "ws-02");

    expect(useAgentStore.getState().selectedId).toBe("coder");
    const req = useCameraStore.getState().focusRequest;
    expect(req).not.toBeNull();
    expect(req!.agentId).toBe("coder");
    const pos = AGENT_SPAWN_POSITION("ws-02");
    expect(req!.position).toEqual([pos[0], 1.2, pos[2]]);
  });

  it("bumps the focus nonce on every selection so the camera rig reacts", () => {
    useAgentStore.getState().applySnapshot([makeAgent("nika", "ws-01")]);

    selectAgentFromScene("nika", "ws-01");
    const first = useCameraStore.getState().focusRequest!.nonce;
    selectAgentFromScene("nika", "ws-01");
    const second = useCameraStore.getState().focusRequest!.nonce;

    expect(second).toBeGreaterThan(first);
  });

  it("works for unknown workstation ids (deterministic fallback slot)", () => {
    useAgentStore.getState().applySnapshot([makeAgent("x", "ws-99")]);

    selectAgentFromScene("x", "ws-99");

    expect(useAgentStore.getState().selectedId).toBe("x");
    expect(useCameraStore.getState().focusRequest).not.toBeNull();
  });
});

describe("makeAgentClickHandler", () => {
  it("stops propagation and runs the shared selection path", () => {
    useAgentStore.getState().applySnapshot([makeAgent("nika", "ws-01")]);

    const stopPropagation = vi.fn();
    const handler = makeAgentClickHandler("nika", "ws-01");
    handler({ stopPropagation } as unknown as Parameters<typeof handler>[0]);

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(useAgentStore.getState().selectedId).toBe("nika");
    expect(useCameraStore.getState().focusRequest?.agentId).toBe("nika");
  });
});
