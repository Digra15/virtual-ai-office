/**
 * Offline-sweeper test: an agent that goes silent is marked `offline`.
 *
 * The sweeper interval is `min(5000, offlineTimeoutMs)`, so with a 400 ms
 * timeout it ticks every 400 ms and a ~1.2 s wait gives generous margin
 * while keeping the test fast.
 *
 * Run with `npm run test --workspace @virtual-ai-office/server`.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../index';

describe('offline sweep', () => {
  it('marks a silent agent offline after the timeout', async () => {
    const { app, start } = createApp({ demoMode: false, offlineTimeoutMs: 400 });
    const handle = await start(0);
    try {
      const post = await request(app)
        .post('/api/agents/probe-1/events')
        .send({ type: 'heartbeat' });
      expect(post.status).toBe(200);

      const before = await request(app).get('/api/agents/probe-1');
      expect(before.status).toBe(200);
      expect(before.body.agent.status).not.toBe('offline');

      await new Promise((resolve) => setTimeout(resolve, 1200));

      const after = await request(app).get('/api/agents/probe-1');
      expect(after.status).toBe(200);
      expect(after.body.agent.status).toBe('offline');
      // The sweep appends a system entry explaining the transition.
      expect(after.body.agent.activityHistory[0].kind).toBe('system');
    } finally {
      await handle.close();
    }
  }, 10_000);
});
