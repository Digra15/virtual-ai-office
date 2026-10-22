#!/usr/bin/env node
/**
 * report-agent.mjs — minimal example of a REAL agent reporting into the
 * Virtual AI Office backend. Uses only the global `fetch` (Node 20+), no deps.
 *
 * Usage:
 *   node examples/report-agent.mjs [baseUrl] [agentId]
 *   node examples/report-agent.mjs http://localhost:4000 my-agent
 *
 * Event schema — POST /api/agents/:id/events with a JSON body:
 *   { "type": "heartbeat" }
 *       Keep-alive. Refreshes `lastSeen`; revives an agent marked offline.
 *   { "type": "status", "status": "<AgentStatus>" }
 *       AgentStatus = idle | working | thinking | waiting | error | offline.
 *       Optional "message" overrides the auto-generated log line.
 *   { "type": "task", "task": "<1-500 chars>", "progress": <0-100 | null> }
 *       Reports what the agent is doing. `progress` is optional (null = unknown).
 *       Optional "message" overrides the auto-generated log line.
 *   { "type": "event", "kind": "status|task|note|system", "message": "<1-2000 chars>" }
 *       Free-form activity log entry. Optional "timestamp" (ISO 8601) on any
 *       event type lets the agent backfill its own clock.
 *
 * Unknown agent ids are created on first event as `source: "live"`.
 * On success the server returns 200 with `{ "agent": <AgentInfo> }` and
 * broadcasts `agent.update` / `agent.event` to all WebSocket clients.
 */

const baseUrl = (process.argv[2] ?? 'http://localhost:4000').replace(/\/+$/, '');
const agentId = process.argv[3] ?? 'example-reporter';

async function postEvent(body) {
  const url = `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/events`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    // Non-JSON response — leave data as {}.
  }
  const summary = JSON.stringify(data).slice(0, 160);
  console.log(`→ POST ${body.type.padEnd(9)} ${res.status} ${summary}`);
  if (!res.ok) {
    throw new Error(`POST ${body.type} failed with status ${res.status}`);
  }
  return data;
}

console.log(`Reporting as agent "${agentId}" to ${baseUrl}`);

await postEvent({ type: 'heartbeat' });
await postEvent({ type: 'status', status: 'working' });
await postEvent({ type: 'task', task: 'Writing the weekly integration report', progress: 25 });
await postEvent({ type: 'task', task: 'Writing the weekly integration report', progress: 80 });
await postEvent({ type: 'event', kind: 'note', message: 'Draft complete — sending for review.' });
await postEvent({ type: 'status', status: 'idle', message: 'Report filed. Standing by.' });

console.log('Done. Watch the dashboard update in real time.');
