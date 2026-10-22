import { useState } from "react";
import { useAgentStore } from "../../stores/useAgentStore";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  useTaskStore,
  type Task,
  type TaskStatus,
} from "../../stores/useTaskStore";
import { STATUS_META } from "../../utils/status";

/**
 * Kanban board synced to the agent roster (single source of truth in the
 * task store). Moving a card updates the assignee's current task/progress;
 * completing a card (→ Done) sets progress to 100%, which triggers the
 * agent's celebrate animation.
 *
 * Interactions are click-based (advance / send back) plus an assignee
 * picker — no drag-and-drop, keeping it reliable on touch and desktop.
 */
function TaskCard({ task }: { task: Task }) {
  const agents = useAgentStore((s) => s.agents);
  const moveTask = useTaskStore((s) => s.moveTask);
  const setAssignee = useTaskStore((s) => s.setAssignee);
  const removeTask = useTaskStore((s) => s.removeTask);

  const assignee = task.assigneeId ? agents[task.assigneeId] : null;
  const idx = TASK_STATUSES.indexOf(task.status);
  const canForward = idx < TASK_STATUSES.length - 1;
  const canBack = idx > 0;

  return (
    <div className="kanban-card">
      <p className="kanban-card-title">{task.title}</p>
      <div className="kanban-card-meta">
        {assignee ? (
          <span
            className="assignee"
            title={`${assignee.name} · ${assignee.role}`}
          >
            <span
              className="dot"
              style={{ backgroundColor: STATUS_META[assignee.status].color }}
            />
            {assignee.name}
          </span>
        ) : (
          <span className="muted">unassigned</span>
        )}
        <span className="muted">{task.progress}%</span>
      </div>
      <div className="kanban-card-actions">
        <select
          className="mini-select"
          value={task.assigneeId ?? ""}
          onChange={(e) => setAssignee(task.id, e.target.value || null)}
          aria-label={`Assignee for ${task.title}`}
        >
          <option value="">Unassigned</option>
          {Object.values(agents)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
        <div className="kanban-steppers">
          <button
            type="button"
            className="mini-btn"
            disabled={!canBack}
            onClick={() => moveTask(task.id, TASK_STATUSES[idx - 1])}
            aria-label={`Move ${task.title} back`}
          >
            ‹
          </button>
          <button
            type="button"
            className="mini-btn"
            disabled={!canForward}
            onClick={() => moveTask(task.id, TASK_STATUSES[idx + 1])}
            aria-label={`Advance ${task.title}`}
          >
            ›
          </button>
          <button
            type="button"
            className="mini-btn danger"
            onClick={() => removeTask(task.id)}
            aria-label={`Delete ${task.title}`}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

export function KanbanBoard({ onClose }: { onClose: () => void }) {
  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const agents = useAgentStore((s) => s.agents);
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState("");

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    addTask(title, newAssignee || null);
    setNewTitle("");
  };

  return (
    <div className="side-panel kanban-panel" role="dialog" aria-label="Task board">
      <div className="side-panel-header">
        <h2>Task Board</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close task board">
          ✕
        </button>
      </div>
      <p className="muted small">
        Synced with the roster — completing a card celebrates the agent.{" "}
        <span className="sim-badge">SIMULATED</span>
      </p>
      <div className="kanban-add">
        <input
          type="text"
          className="text-input"
          placeholder="New task title…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          aria-label="New task title"
        />
        <select
          className="mini-select"
          value={newAssignee}
          onChange={(e) => setNewAssignee(e.target.value)}
          aria-label="Assignee for new task"
        >
          <option value="">Unassigned</option>
          {Object.values(agents)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
        <button
          type="button"
          className="primary-btn"
          onClick={handleAdd}
          disabled={!newTitle.trim()}
        >
          Add
        </button>
      </div>
      <div className="kanban-columns">
        {TASK_STATUSES.map((status: TaskStatus) => {
          const column = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="kanban-column">
              <h3>
                {TASK_STATUS_LABELS[status]}
                <span className="count">{column.length}</span>
              </h3>
              <div className="kanban-cards">
                {column.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
                {column.length === 0 && (
                  <p className="muted small empty">No cards</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
