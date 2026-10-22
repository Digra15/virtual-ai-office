/**
 * WebSocket hub tests: real `ws` client against a server on an ephemeral port.
 *
 * Run with `npm run test --workspace @virtual-ai-office/server`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import WebSocket from 'ws';
import { createApp } from '../index';

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const close of closers.splice(0)) {
    await close();
  }
});

interface WireMessage {
  type: string;
  [key: string]: unknown;
}

function frameText(data: WebSocket.RawData): string {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data).toString('utf8');
}

function connect(port: number): WebSocket {
  return new WebSocket(`ws://127.0.0.1:${port}/ws`);
}

function waitForMessage(ws: WebSocket, predicate: (m: WireMessage) => boolean, timeoutMs = 5000): Promise<WireMessage> {
  return new Promise<WireMessage>((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('timed out waiting for message'));
    }, timeoutMs);
    const onMessage = (data: WebSocket.RawData): void => {
      let msg: WireMessage;
      try {
        msg = JSON.parse(frameText(data)) as WireMessage;
      } catch {
        return;
      }
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve(msg);
      }
    };
    ws.on('message', onMessage);
    ws.on('error', (err) => {
      clearTimeout(timer);
      ws.off('message', onMessage);
      reject(err);
    });
  });
}

describe('websocket hub', () => {
  it('sends a snapshot on connect', async () => {
    const { start } = createApp({ demoMode: false, offlineTimeoutMs: 60_000 });
    const handle = await start(0);
    closers.push(handle.close);

    const ws = connect(handle.port);
    const snapshot = await waitForMessage(ws, (m) => m.type === 'snapshot');

    expect(snapshot.type).toBe('snapshot');
    expect(snapshot.demoMode).toBe(false);
    expect(snapshot.agents).toEqual([]);
    expect(typeof snapshot.serverTime).toBe('string');
    ws.close();
  });

  it('broadcasts agent.update and agent.event after an HTTP POST', async () => {
    const { app, start } = createApp({ demoMode: false, offlineTimeoutMs: 60_000 });
    const handle = await start(0);
    closers.push(handle.close);

    const ws = connect(handle.port);
    await waitForMessage(ws, (m) => m.type === 'snapshot');

    const updatePromise = waitForMessage(ws, (m) => m.type === 'agent.update');
    const eventPromise = waitForMessage(ws, (m) => m.type === 'agent.event');

    const res = await request(app)
      .post('/api/agents/ws-agent/events')
      .send({ type: 'task', task: 'Writing tests', progress: 50 });
    expect(res.status).toBe(200);

    const update = await updatePromise;
    const event = await eventPromise;

    expect((update.agent as { id: string }).id).toBe('ws-agent');
    expect((update.agent as { currentTask: string }).currentTask).toBe('Writing tests');
    expect(event.agentId).toBe('ws-agent');
    expect((event.entry as { kind: string }).kind).toBe('task');
    ws.close();
  });

  it('answers ping with a heartbeat', async () => {
    const { start } = createApp({ demoMode: false, offlineTimeoutMs: 60_000 });
    const handle = await start(0);
    closers.push(handle.close);

    const ws = connect(handle.port);
    await waitForMessage(ws, (m) => m.type === 'snapshot');

    const heartbeatPromise = waitForMessage(ws, (m) => m.type === 'heartbeat');
    ws.send(JSON.stringify({ type: 'ping' }));
    const heartbeat = await heartbeatPromise;

    expect(heartbeat.type).toBe('heartbeat');
    expect(heartbeat.demoMode).toBe(false);
    ws.close();
  });

  it('survives a malformed frame: replies with error and stays alive', async () => {
    const { start } = createApp({ demoMode: false, offlineTimeoutMs: 60_000 });
    const handle = await start(0);
    closers.push(handle.close);

    const ws = connect(handle.port);
    await waitForMessage(ws, (m) => m.type === 'snapshot');

    const errorPromise = waitForMessage(ws, (m) => m.type === 'error');
    ws.send('this is not json {{{');
    const errorMsg = await errorPromise;
    expect(errorMsg.type).toBe('error');
    expect(typeof errorMsg.message).toBe('string');

    // Server still responsive afterwards.
    const heartbeatPromise = waitForMessage(ws, (m) => m.type === 'heartbeat');
    ws.send(JSON.stringify({ type: 'ping' }));
    const heartbeat = await heartbeatPromise;
    expect(heartbeat.type).toBe('heartbeat');
    ws.close();
  });
});
