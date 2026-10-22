/**
 * Shared domain types for the Virtual AI Office.
 *
 * This module is the single source of truth for the wire contract between
 * the backend (`apps/server`) and the frontend (`apps/web`). Both consume
 * these types verbatim — do not drift from them without updating both sides.
 */

/** Every lifecycle state an agent can be in. */
export const AGENT_STATUSES = [
  'idle',
  'working',
  'thinking',
  'waiting',
  'error',
  'offline',
  'meeting',
  'recovering',
] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

/** Kinds of activity log entries. */
export type ActivityKind = 'status' | 'task' | 'note' | 'system';

/** Where an agent's data comes from. `demo` = clearly-labeled simulator output. */
export type AgentSource = 'demo' | 'live';

/** One row in an agent's activity log. `activityHistory` is newest-first. */
export interface ActivityEntry {
  id: string;
  agentId: string;
  timestamp: string;
  kind: ActivityKind;
  message: string;
}

/** Full snapshot of one agent's current state. */
export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask: string;
  progress: number | null;
  lastSeen: string;
  workstationId: string;
  activityHistory: ActivityEntry[]; /* newest-first */
  source: AgentSource;
}

/** Event types a real agent can POST to `/api/agents/:id/events`. */
export type EventPostType = 'status' | 'task' | 'event' | 'heartbeat';

// ---------------------------------------------------------------------------
// Server -> client WebSocket messages
// ---------------------------------------------------------------------------

export interface ServerSnapshotMessage {
  type: 'snapshot';
  agents: AgentInfo[];
  demoMode: boolean;
  serverTime: string;
}

export interface ServerAgentUpdateMessage {
  type: 'agent.update';
  agent: AgentInfo;
}

export interface ServerAgentEventMessage {
  type: 'agent.event';
  agentId: string;
  entry: ActivityEntry;
}

export interface ServerHeartbeatMessage {
  type: 'heartbeat';
  serverTime: string;
  demoMode: boolean;
}

export interface ServerErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage =
  | ServerSnapshotMessage
  | ServerAgentUpdateMessage
  | ServerAgentEventMessage
  | ServerHeartbeatMessage
  | ServerErrorMessage;

// ---------------------------------------------------------------------------
// Client -> server WebSocket messages
// ---------------------------------------------------------------------------

export interface ClientHelloMessage {
  type: 'hello';
  client?: string;
}

export interface ClientPingMessage {
  type: 'ping';
  at?: string;
}

export type ClientMessage = ClientHelloMessage | ClientPingMessage;

// ---------------------------------------------------------------------------
// REST
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: 'ok';
  uptimeSec: number;
  demoMode: boolean;
  connectedClients: number;
  agentCount: number;
  version: string;
}
