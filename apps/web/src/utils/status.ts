import { AGENT_STATUSES } from "@virtual-ai-office/shared";
import type { AgentStatus } from "@virtual-ai-office/shared";

export interface StatusMeta {
  color: string;
  label: string;
  description: string;
}

/** Every status the backend can report, regardless of whether the shared
 *  package exports them as an array or a record. */
export const ALL_STATUSES: AgentStatus[] = (
  Array.isArray(AGENT_STATUSES)
    ? AGENT_STATUSES
    : Object.keys(AGENT_STATUSES)
) as AgentStatus[];

export const STATUS_META: Record<AgentStatus, StatusMeta> = {
  working: {
    color: "#22c55e",
    label: "Working",
    description: "Actively executing a task right now",
  },
  thinking: {
    color: "#a855f7",
    label: "Thinking",
    description: "Planning, reasoning, or waiting on a model call",
  },
  idle: {
    color: "#94a3b8",
    label: "Idle",
    description: "Online with no active task",
  },
  waiting: {
    color: "#f59e0b",
    label: "Waiting",
    description: "Blocked or awaiting input",
  },
  error: {
    color: "#ef4444",
    label: "Error",
    description: "Hit an error and needs attention",
  },
  offline: {
    color: "#525252",
    label: "Offline",
    description: "Not currently connected",
  },
  meeting: {
    color: "#38bdf8",
    label: "In Meeting",
    description: "In an agent-to-agent meeting right now",
  },
  recovering: {
    color: "#f472b6",
    label: "Recovering",
    description: "Resting in the recovery room after an error",
  },
};
