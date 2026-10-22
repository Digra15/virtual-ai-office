# Agent Event API — Virtual AI Office backend

Base URL: `http://localhost:4000` (env `PORT`). WebSocket: `ws://localhost:4000/ws`.

## REST

### `GET /health`
```json
{ "status": "ok", "uptimeSec": 123, "demoMode": true, "connectedClients": 2, "agentCount": 8, "version": "0.1.0" }
```

### `GET /api/agents` → `{ "agents": AgentInfo[] }`
### `GET /api/agents/:id` → `{ "agent": AgentInfo }` (404 `{ "error" }` if unknown)
### `GET /api/agents/:id/events?limit=50` → `{ "events": ActivityEntry[] }` (newest first; limit default 50, max 200; 404 if unknown)

### `POST /api/agents/:id/events` → `200 { "agent": AgentInfo }`
Rate-limited: 60 requests/min/IP by default (`RATE_LIMIT_PER_MINUTE`).
Malformed JSON → 400. Schema violations → 400 with `details`.

**Request body** (`EventPost`, validated by `EventPostSchema` in
`@virtual-ai-office/shared`):

| Field | Type | Required when |
|---|---|---|
| `type` | `"status" \| "task" \| "event" \| "heartbeat"` | always |
| `status` | `"idle" \| "working" \| "thinking" \| "waiting" \| "error" \| "offline"` | `type: "status"` |
| `task` | string (1–500 chars) | `type: "task"` |
| `progress` | number 0–100 \| null | `type: "task"` (optional) |
| `message` | string (1–2000 chars) | `type: "event"` |
| `kind` | `"status" \| "task" \| "note" \| "system"` | `type: "event"` (optional, default `"note"`) |
| `timestamp` | ISO datetime string | optional (server stamps `now` if omitted) |

**Effect per type**
- `status` — sets agent status, appends a `status` activity entry.
- `task` — sets `currentTask` (+ optional `progress`), appends a `task` entry.
- `event` — appends a free-form activity entry.
- `heartbeat` — refreshes `lastSeen`; revives an `offline` agent back to `idle`.

Posting to an unknown `:id` **creates** the agent (`source: "live"`,
`name` defaults to the id, `role: "External Agent"`, `workstationId: "ws-remote"`).

**Examples**
```bash
# heartbeat (registers the agent if new)
curl -X POST http://localhost:4000/api/agents/worker-1/events \
  -H 'Content-Type: application/json' \
  -d '{"type":"heartbeat"}'

# report status + task with progress
curl -X POST http://localhost:4000/api/agents/worker-1/events \
  -H 'Content-Type: application/json' \
  -d '{"type":"status","status":"working"}'
curl -X POST http://localhost:4000/api/agents/worker-1/events \
  -H 'Content-Type: application/json' \
  -d '{"type":"task","task":"Summarizing inbox","progress":35}'

# free-form activity note
curl -X POST http://localhost:4000/api/agents/worker-1/events \
  -H 'Content-Type: application/json' \
  -d '{"type":"event","kind":"note","message":"Finished triaging 42 threads"}'
```

## WebSocket (`/ws`)

**Server → client** (`ServerMessage`):
- `{ "type": "snapshot", "agents": [...], "demoMode": true, "serverTime": "..." }` — sent on connect (and on `{ "type": "hello" }`).
- `{ "type": "agent.update", "agent": {…} }` — full agent object after any change.
- `{ "type": "agent.event", "agentId": "…", "entry": {…} }` — one new activity entry.
- `{ "type": "heartbeat", "serverTime": "…", "demoMode": true }` — every 15 s.
- `{ "type": "error", "message": "…" }` — e.g. after a malformed frame.

**Client → server**: `{ "type": "hello" }` (re-request snapshot),
`{ "type": "ping" }` (answered with a heartbeat). Malformed frames get an
`error` reply and never crash the server.

## Data shapes

```ts
interface AgentInfo {
  id: string; name: string; role: string;
  status: "idle" | "working" | "thinking" | "waiting" | "error" | "offline";
  currentTask: string; progress: number | null;
  lastSeen: string;            // ISO datetime
  workstationId: string;
  activityHistory: ActivityEntry[]; // newest first, capped at 100
  source: "demo" | "live";     // "demo" = simulated, never real data
}
interface ActivityEntry {
  id: string; agentId: string; timestamp: string;
  kind: "status" | "task" | "note" | "system"; message: string;
}
```

## Connecting a real agent source

1. Have the agent (or a small sidecar) POST `heartbeat` every ≤ `OFFLINE_TIMEOUT_MS`
   (default 30 s) and `status`/`task`/`event` payloads as things change.
2. Or run the sample client: `node apps/server/examples/report-agent.mjs [baseUrl] [agentId]`.
3. For deeper integration, implement the `AgentAdapter` interface
   (`apps/server/src/adapters/types.ts`): `start(emit)` / `stop()` — the same
   pipeline the demo simulator uses. Do not assume any external system exposes
   a particular endpoint; verify first.
4. Monitoring only: the backend has no remote-execution capability by design.
