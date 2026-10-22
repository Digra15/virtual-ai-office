import type { AgentInfo } from "@virtual-ai-office/shared";
import { STATUS_META } from "../../utils/status";
import { timeAgo } from "../../utils/format";

interface AgentCardProps {
  agent: AgentInfo;
  selected: boolean;
  onSelect: () => void;
}

/** Compact agent row in the sidebar list. */
export function AgentCard({ agent, selected, onSelect }: AgentCardProps) {
  const meta = STATUS_META[agent.status];
  return (
    <button
      type="button"
      className={`agent-card${selected ? " selected" : ""}`}
      onClick={onSelect}
      aria-label={`Select agent ${agent.name}`}
      aria-pressed={selected}
    >
      <div className="agent-card-top">
        <span
          className="status-dot"
          style={{ backgroundColor: meta.color }}
          aria-hidden="true"
        />
        <span className="name">{agent.name}</span>
        <span className="role">{agent.role}</span>
      </div>
      {agent.currentTask ? (
        <div className="task" title={agent.currentTask}>
          {agent.currentTask}
        </div>
      ) : (
        <div className="task">{meta.description}</div>
      )}
      {agent.progress !== null && agent.progress !== undefined && (
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={agent.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${agent.name} progress`}
        >
          <div style={{ width: `${agent.progress}%` }} />
        </div>
      )}
      <div className="seen">last seen {timeAgo(agent.lastSeen)}</div>
    </button>
  );
}
