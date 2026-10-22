import { beforeEach, describe, expect, it } from "vitest";
import { _resetTaskCounterForTests, useTaskStore } from "./useTaskStore";
import { useAgentStore } from "./useAgentStore";
import type { AgentInfo } from "@virtual-ai-office/shared";

function seedAgents(): void {
  const mk = (
    id: string,
    name: string,
    status: AgentInfo["status"],
    task: string,
    progress: number | null,
  ): AgentInfo => ({
    id,
    name,
    role: "Test Agent",
    status,
    currentTask: task,
    progress,
    lastSeen: new Date().toISOString(),
    workstationId: "ws-01",
    activityHistory: [],
    source: "demo",
  });
  useAgentStore.getState().applySnapshot([
    mk("a1", "Ava", "working", "Build the thing", 40),
    mk("a2", "Ben", "idle", "Awaiting assignment", null),
  ]);
}

describe("task store (kanban)", () => {
  beforeEach(() => {
    _resetTaskCounterForTests();
    useTaskStore.setState({ tasks: [] });
    seedAgents();
  });

  it("seeds tasks from agents' current tasks (idempotent)", () => {
    useTaskStore.getState().seedFromAgents();
    useTaskStore.getState().seedFromAgents();
    const tasks = useTaskStore.getState().tasks;
    // Only Ava has a real task; Ben is awaiting assignment.
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      title: "Build the thing",
      assigneeId: "a1",
      status: "in_progress",
      progress: 40,
    });
  });

  it("addTask creates a todo card", () => {
    const t = useTaskStore.getState().addTask("New thing", "a2");
    expect(t.status).toBe("todo");
    expect(useTaskStore.getState().tasks).toHaveLength(1);
  });

  it("moveTask advances status and syncs the agent", () => {
    useTaskStore.getState().seedFromAgents();
    const task = useTaskStore.getState().tasks[0];
    useTaskStore.getState().moveTask(task.id, "review");
    const agent = useAgentStore.getState().agents["a1"];
    expect(agent.status).toBe("thinking");
    expect(agent.currentTask).toBe("Build the thing");
    // No-op on same status.
    useTaskStore.getState().moveTask(task.id, "review");
    expect(useTaskStore.getState().tasks[0].status).toBe("review");
  });

  it("completing a task sets agent progress to 100 (celebrate trigger)", () => {
    useTaskStore.getState().seedFromAgents();
    const task = useTaskStore.getState().tasks[0];
    useTaskStore.getState().moveTask(task.id, "done");
    const agent = useAgentStore.getState().agents["a1"];
    expect(agent.progress).toBe(100);
    expect(agent.status).toBe("idle");
    expect(useTaskStore.getState().tasks[0].status).toBe("done");
  });

  it("setAssignee reassigns and syncs", () => {
    const t = useTaskStore.getState().addTask("Unassigned", null);
    useTaskStore.getState().setAssignee(t.id, "a2");
    expect(useTaskStore.getState().tasks[0].assigneeId).toBe("a2");
    expect(useAgentStore.getState().agents["a2"].currentTask).toBe("Unassigned");
  });

  it("setProgress clamps to 0-100", () => {
    const t = useTaskStore.getState().addTask("X", "a1");
    useTaskStore.getState().setProgress(t.id, 150);
    expect(useTaskStore.getState().tasks[0].progress).toBe(100);
    useTaskStore.getState().setProgress(t.id, -20);
    expect(useTaskStore.getState().tasks[0].progress).toBe(0);
  });

  it("removeTask deletes the card", () => {
    const t = useTaskStore.getState().addTask("X", null);
    useTaskStore.getState().removeTask(t.id);
    expect(useTaskStore.getState().tasks).toHaveLength(0);
  });
});
