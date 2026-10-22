/**
 * REST API tests (supertest against `createApp`, no network ports needed).
 *
 * Run with `npm run test --workspace @virtual-ai-office/server`.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../index';

function makeApp() {
  // Demo mode off so the registry starts empty and deterministic.
  return createApp({ demoMode: false, offlineTimeoutMs: 60_000 });
}

describe('GET /health', () => {
  it('returns the HealthResponse shape', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.demoMode).toBe(false);
    expect(typeof res.body.uptimeSec).toBe('number');
    expect(typeof res.body.connectedClients).toBe('number');
    expect(res.body.agentCount).toBe(0);
    expect(res.body.version).toBe('0.1.0');
  });
});

describe('agents API', () => {
  it('GET /api/agents returns an empty list with no demo agents', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/agents');

    expect(res.status).toBe(200);
    expect(res.body.agents).toEqual([]);
  });

  it('POST a valid status event creates a live agent', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/agents/probe-x/events')
      .send({ type: 'status', status: 'working' });

    expect(res.status).toBe(200);
    expect(res.body.agent.id).toBe('probe-x');
    expect(res.body.agent.status).toBe('working');
    expect(res.body.agent.source).toBe('live');
    expect(res.body.agent.workstationId).toBe('ws-remote');
  });

  it('POST a task event updates currentTask and progress', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/agents/worker-1/events')
      .send({ type: 'task', task: 'Crunching numbers', progress: 75 });

    expect(res.status).toBe(200);
    expect(res.body.agent.currentTask).toBe('Crunching numbers');
    expect(res.body.agent.progress).toBe(75);
    expect(res.body.agent.activityHistory[0].kind).toBe('task');
  });

  it('POST missing a required field → 400', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/agents/a/events').send({ type: 'status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST an unknown status → 400', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/agents/a/events')
      .send({ type: 'status', status: 'dancing' });

    expect(res.status).toBe(400);
  });

  it('POST progress above 100 → 400', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/agents/a/events')
      .send({ type: 'task', task: 'Too much', progress: 101 });

    expect(res.status).toBe(400);
  });

  it('POST malformed JSON → 400', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/agents/a/events')
      .set('Content-Type', 'application/json')
      .send('{"type":');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid JSON');
  });

  it('GET an unknown agent → 404', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/agents/nope');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('GET events for an unknown agent → 404', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/agents/nope/events');

    expect(res.status).toBe(404);
  });

  it('GET events respects the limit and returns newest-first', async () => {
    const { app } = makeApp();
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post('/api/agents/ev-1/events')
        .send({ type: 'event', kind: 'note', message: `note ${i}` });
      expect(res.status).toBe(200);
    }

    const res = await request(app).get('/api/agents/ev-1/events?limit=3');

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(3);
    expect(res.body.events[0].message).toBe('note 4');
    expect(res.body.events[2].message).toBe('note 2');
  });

  it('GET events clamps the limit to 200', async () => {
    const { app } = makeApp();
    await request(app)
      .post('/api/agents/ev-2/events')
      .send({ type: 'event', kind: 'note', message: 'one' });

    const res = await request(app).get('/api/agents/ev-2/events?limit=9999');

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
  });
});
