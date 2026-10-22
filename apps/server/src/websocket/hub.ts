/**
 * WsHub — WebSocket server for live agent state.
 *
 * Mounted on the `/ws` upgrade path with `noServer: true` (see `src/index.ts`).
 *
 * Protocol (client -> server):
 *   { "type": "hello" }            — (re)request the full snapshot
 *   { "type": "ping" }             — answered with a `heartbeat`
 *
 * Protocol (server -> client): the `ServerMessage` union from
 * `@virtual-ai-office/shared` — `snapshot`, `agent.update`, `agent.event`,
 * `heartbeat`, `error`.
 *
 * Malformed frames get an `{ type: 'error', ... }` reply and never crash
 * the server.
 */
import WebSocket, { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import type { AgentInfo, ServerMessage } from '@virtual-ai-office/shared';

const HEARTBEAT_INTERVAL_MS = 15_000;

/** Convert an incoming `ws` frame payload to a UTF-8 string. */
function rawToString(raw: WebSocket.RawData): string {
  if (typeof raw === 'string') return raw;
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8');
  return Buffer.from(raw).toString('utf8');
}

export interface WsHubDeps {
  getAgents: () => AgentInfo[];
  isDemoMode: () => boolean;
}

export class WsHub {
  private readonly wss: WebSocketServer;
  private readonly clients = new Set<WebSocket>();
  private readonly heartbeatTimer: NodeJS.Timeout;

  constructor(private readonly deps: WsHubDeps) {
    this.wss = new WebSocketServer({ noServer: true });
    this.heartbeatTimer = setInterval(() => {
      this.broadcast({
        type: 'heartbeat',
        serverTime: new Date().toISOString(),
        demoMode: this.deps.isDemoMode(),
      });
    }, HEARTBEAT_INTERVAL_MS);
    if (typeof this.heartbeatTimer.unref === 'function') this.heartbeatTimer.unref();
  }

  /** Called from the HTTP server's `upgrade` handler for `/ws`. */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(req, socket, head, (ws) => this.onConnection(ws));
  }

  /** Fan-out a server message to every connected client. */
  broadcast(msg: ServerMessage): void {
    const text = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(text);
      }
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }

  /** Release the heartbeat timer and drop all clients. */
  close(): void {
    clearInterval(this.heartbeatTimer);
    for (const client of this.clients) {
      try {
        client.close();
      } catch {
        // Client already gone — nothing to do.
      }
    }
    this.clients.clear();
    this.wss.close();
  }

  private onConnection(ws: WebSocket): void {
    this.clients.add(ws);
    this.sendSnapshot(ws);
    ws.on('message', (raw) => this.onMessage(ws, raw));
    ws.on('close', () => {
      this.clients.delete(ws);
    });
    ws.on('error', () => {
      this.clients.delete(ws);
    });
  }

  private sendSnapshot(ws: WebSocket): void {
    this.send(ws, {
      type: 'snapshot',
      agents: this.deps.getAgents(),
      demoMode: this.deps.isDemoMode(),
      serverTime: new Date().toISOString(),
    });
  }

  private onMessage(ws: WebSocket, raw: WebSocket.RawData): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawToString(raw));
    } catch {
      this.send(ws, { type: 'error', message: 'Malformed JSON message' });
      return;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      this.send(ws, { type: 'error', message: 'Message must be a JSON object' });
      return;
    }
    const type = (parsed as { type?: unknown }).type;
    if (type === 'ping') {
      this.send(ws, {
        type: 'heartbeat',
        serverTime: new Date().toISOString(),
        demoMode: this.deps.isDemoMode(),
      });
      return;
    }
    if (type === 'hello') {
      this.sendSnapshot(ws);
      return;
    }
    this.send(ws, { type: 'error', message: `Unknown message type: ${String(type)}` });
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}
