import { create } from "zustand";
import { useAgentStore } from "./useAgentStore";

/**
 * Kanban task board — the single source of truth for work items.
 *
 * Tasks are synced to agents: moving a card updates the assignee's
 * `currentTask`/`progress` in the agent store, and completing a task
 * (status → done, progress → 100) triggers the agent's celebrate
 * animation via the existing progress watcher in ChibiFigure.
 */

export type TaskStatus = "todo" | "in_progress" | "review" | "done";

export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  /** 0–100. */
  progress: number;
}

interface TaskState {
  tasks: Task[];
  /** Seed tasks from the demo agents' current tasks (idempotent). */
  seedFromAgents: () => void;
  addTask: (title: string, assigneeId: string | null) => Task;
  /** Move a card; syncs the assignee agent. */
  moveTask: (taskId: string, status: TaskStatus) => void;
  setAssignee: (taskId: string, assigneeId: string | null) => void;
  setProgress: (taskId: string, progress: number) => void;
  removeTask: (taskId: string) => void;
}

let taskCounter = 0;
function nextTaskId(): string {
  taskCounter += 1;
  return `task-${Date.now().toString(36)}-${taskCounter}`;
}

/** Push task state onto the assigned agent (single source of truth). */
function syncAgentToTask(task: Task): void {
  if (!task.assigneeId) return;
  const agentStore = useAgentStore.getState();
  const agent = agentStore.agents[task.assigneeId];
  if (!agent) return;
  const status =
    task.status === "done"
      ? "idle"
      : task.status === "in_progress"
        ? "working"
        : task.status === "review"
          ? "thinking"
          : agent.status;
  const progress = task.status === "done" ? 100 : task.progress;
  // Progress 100 on a task that just completed triggers celebrate.
  agentStore.applyUpdate({
    ...agent,
    currentTask: task.title,
    progress,
    status,
    lastSeen: new Date().toISOString(),
  });
}

export const useTaskStore = create<TaskState>()((set, get) => ({
  tasks: [],

  seedFromAgents: () => {
    if (get().tasks.length > 0) return;
    const agents = Object.values(useAgentStore.getState().agents);
    const tasks: Task[] = agents
      .filter((a) => a.currentTask && a.currentTask !== "Awaiting assignment")
      .map((a) => ({
        id: nextTaskId(),
        title: a.currentTask,
        status: a.status === "working" ? "in_progress" : ("todo" as TaskStatus),
        assigneeId: a.id,
        progress: a.progress ?? 0,
      }));
    set({ tasks });
  },

  addTask: (title, assigneeId) => {
    const task: Task = {
      id: nextTaskId(),
      title: title.trim(),
      status: "todo",
      assigneeId,
      progress: 0,
    };
    set((s) => ({ tasks: [...s.tasks, task] }));
    return task;
  },

  moveTask: (taskId, status) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    const updated = { ...task, status };
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)),
    }));
    syncAgentToTask(updated);
  },

  setAssignee: (taskId, assigneeId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = { ...task, assigneeId };
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)),
    }));
    syncAgentToTask(updated);
  },

  setProgress: (taskId, progress) => {
    const clamped = Math.max(0, Math.min(100, Math.round(progress)));
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = { ...task, progress: clamped };
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)),
    }));
    syncAgentToTask(updated);
  },

  removeTask: (taskId) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }));
  },
}));

/** Reset the id counter (tests only). */
export function _resetTaskCounterForTests(): void {
  taskCounter = 0;
}
