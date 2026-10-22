import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AgentInfo } from "@virtual-ai-office/shared";
import { useAgentStore } from "../../stores/useAgentStore";
import { AgentList } from "./AgentList";

afterEach(() => cleanup());

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

function seed() {
  useAgentStore.setState({ agents: {}, selectedId: null, globalEvents: [] });
  useAgentStore.getState().applySnapshot([
    makeAgent({ id: "nika", name: "Nika", role: "Personal Assistant", status: "working" }),
    makeAgent({ id: "coding", name: "Coding", role: "Coding Agent", status: "working" }),
    makeAgent({ id: "watch", name: "Watch", role: "Monitoring Agent", status: "error" }),
  ]);
}

beforeEach(seed);

describe("AgentList", () => {
  it("renders all agents from the store", () => {
    render(<AgentList />);
    expect(screen.getByText("Nika")).toBeInTheDocument();
    expect(screen.getByText("Coding")).toBeInTheDocument();
    expect(screen.getByText("Watch")).toBeInTheDocument();
  });

  it("filters by search text", () => {
    render(<AgentList />);
    fireEvent.change(screen.getByLabelText(/search agents/i), {
      target: { value: "cod" },
    });
    expect(screen.getByText("Coding")).toBeInTheDocument();
    expect(screen.queryByText("Nika")).not.toBeInTheDocument();
    expect(screen.queryByText("Watch")).not.toBeInTheDocument();
  });

  it("filters by status chip", () => {
    render(<AgentList />);
    fireEvent.click(screen.getByRole("button", { name: /filter by error/i }));
    expect(screen.getByText("Watch")).toBeInTheDocument();
    expect(screen.queryByText("Nika")).not.toBeInTheDocument();
    expect(screen.queryByText("Coding")).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", () => {
    render(<AgentList />);
    fireEvent.change(screen.getByLabelText(/search agents/i), {
      target: { value: "zzz-no-such-agent" },
    });
    expect(screen.getByText(/no agents match/i)).toBeInTheDocument();
  });

  it("selecting a card marks it selected in the store", () => {
    render(<AgentList />);
    fireEvent.click(screen.getByRole("button", { name: /select agent nika/i }));
    expect(useAgentStore.getState().selectedId).toBe("nika");
  });
});
