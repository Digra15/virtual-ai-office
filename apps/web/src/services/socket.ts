import type {
  ActivityEntry,
  AgentInfo,
  ServerMessage,
} from "@virtual-ai-office/shared";

export type SocketStatus = "connecting" | "live" | "error";

export interface ConnectSocketOptions {
  wsUrl: string;
  onSnapshot: (agents: AgentInfo[], demoMode: boolean) => void;
  onUpdate: (agent: AgentInfo) => void;
  onEvent: (agentId: string, entry: ActivityEntry) => void;
  onHeartbeat: (serverTime: string, demoMode: boolean) => void;
  onStatus: (status: SocketStatus) => void;
  /** Optional: admin broadcasts the Worker sends on admin mutations. */
  onConfigUpdate?: () => void;
  onWorkersUpdate?: () => void;
  onServicesUpdate?: () => void;
}

const MAX_BACKOFF_MS = 30_000;
const PING_INTERVAL_MS = 20_000;

/**
 * Opens the backend WebSocket and keeps it alive with exponential-backoff
 * reconnects (1s doubling up to 30s). Returns a `disconnect()` function that
 * permanently tears the connection down.
 */
export function connectSocket(opts: ConnectSocketOptions): () => void {
  let closed = false;
  let ws: WebSocket | null = null;
  let attempt = 0;
  let backoffTimer: number | null = null;
  let pingTimer: number | null = null;

  const clearTimers = () => {
    if (backoffTimer !== null) {
      window.clearTimeout(backoffTimer);
      backoffTimer = null;
    }
    if (pingTimer !== null) {
      window.clearInterval(pingTimer);
      pingTimer = null;
    }
  };

  const send = (payload: unknown) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  const scheduleReconnect = () => {
    if (closed) return;
    attempt += 1;
    const delay = Math.min(1000 * 2 ** (attempt - 1), MAX_BACKOFF_MS);
    opts.onStatus("connecting");
    backoffTimer = window.setTimeout(() => {
      backoffTimer = null;
      connect();
    }, delay);
  };

  const handleMessage = (raw: string) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return; // ignore malformed frames
    }
    if (!msg || typeof msg !== "object") return;
    switch (msg.type) {
      case "snapshot":
        attempt = 0;
        opts.onSnapshot(msg.agents, msg.demoMode);
        break;
      case "agent.update":
        opts.onUpdate(msg.agent);
        break;
      case "agent.event":
        opts.onEvent(msg.agentId, msg.entry);
        break;
      case "heartbeat":
        opts.onHeartbeat(msg.serverTime, msg.demoMode);
        break;
      case "error":
        // Server-side notice; the connection itself stays alive.
        console.warn("[socket] server error:", msg.message);
        break;
      default:
        handleAdminBroadcast(msg);
        break;
    }
  };

  /** Dispatches admin live-update broadcasts (unknown to the old schema). */
  const handleAdminBroadcast = (msg: { type?: unknown }) => {
    switch (msg.type) {
      case "config.update":
        opts.onConfigUpdate?.();
        break;
      case "workers.update":
        opts.onWorkersUpdate?.();
        break;
      case "services.update":
        opts.onServicesUpdate?.();
        break;
      default:
        break;
    }
  };

  const connect = () => {
    if (closed) return;
    opts.onStatus("connecting");
    try {
      ws = new WebSocket(opts.wsUrl);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      if (closed) return;
      attempt = 0;
      opts.onStatus("live");
      send({ type: "hello", client: "web" });
      pingTimer = window.setInterval(() => send({ type: "ping" }), PING_INTERVAL_MS);
    };
    ws.onmessage = (ev: MessageEvent) => handleMessage(String(ev.data));
    ws.onerror = () => {
      opts.onStatus("error");
    };
    ws.onclose = () => {
      clearTimers();
      ws = null;
      scheduleReconnect();
    };
  };

  connect();

  return () => {
    closed = true;
    clearTimers();
    try {
      ws?.close();
    } catch {
      /* already closed */
    }
    ws = null;
  };
}
