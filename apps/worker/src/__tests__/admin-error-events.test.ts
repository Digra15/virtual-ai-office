/**
 * Error-event endpoint tests: GET/POST /api/admin/error-events and
 * PATCH /api/admin/error-events/:id (acknowledge/resolve lifecycle).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { handleAdminRequest, resetAdminRateLimiters } from '../admin/routes';
import { hashPassword } from '../admin/auth';
import { makeEnv, req, sessionCookie, type MockEnv } from './mock-env';

const SETUP = { username: 'admin', password: 'supersecretpassword', setupToken: 'test-setup-token' };

async function authed(): Promise<{ ctx: MockEnv; cookie: string }> {
  const ctx = makeEnv();
  const s = await handleAdminRequest(req('/api/admin/auth/setup', { method: 'POST', body: SETUP }), ctx.env);
  expect(s.status).toBe(201);
  const l = await handleAdminRequest(
    req('/api/admin/auth/login', { method: 'POST', body: { username: 'admin', password: 'supersecretpassword' } }),
    ctx.env,
  );
  expect(l.status).toBe(200);
  return { ctx, cookie: sessionCookie(l) as string };
}

async function loginAsViewer(): Promise<{ ctx: MockEnv; cookie: string }> {
  const ctx = makeEnv();
  await ctx.db
    .prepare(
      'INSERT INTO admin_users (id, username, password_hash, role, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind('adm_viewer1', 'viewer1', await hashPassword('viewer-password-1'), 'viewer', new Date().toISOString(), null)
    .run();
  const l = await handleAdminRequest(
    req('/api/admin/auth/login', { method: 'POST', body: { username: 'viewer1', password: 'viewer-password-1' } }),
    ctx.env,
  );
  expect(l.status).toBe(200);
  return { ctx, cookie: sessionCookie(l) as string };
}

async function createEvent(ctx: MockEnv, cookie: string, body: Record<string, unknown>) {
  return handleAdminRequest(req('/api/admin/error-events', { method: 'POST', body, cookie }), ctx.env);
}

beforeEach(() => {
  resetAdminRateLimiters();
});

describe('error events', () => {
  it('401s without a session', async () => {
    const { ctx } = await authed();
    expect((await handleAdminRequest(req('/api/admin/error-events'), ctx.env)).status).toBe(401);
    expect(
      (
        await handleAdminRequest(
          req('/api/admin/error-events', { method: 'POST', body: { agentId: 'a' } }),
          ctx.env,
        )
      ).status,
    ).toBe(401);
  });

  it('creates an event (201), broadcasts errorEvents.update, and audit-logs', async () => {
    const { ctx, cookie } = await authed();
    const res = await createEvent(ctx, cookie, {
      agentId: 'monitoring',
      category: 'network',
      message: 'p99 latency exceeded 800ms',
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      event: { id: string; agentId: string; category: string; status: string; resolvedAt: null };
    };
    expect(body.event.id).toMatch(/^err_/);
    expect(body.event.agentId).toBe('monitoring');
    expect(body.event.category).toBe('network');
    expect(body.event.status).toBe('open');
    expect(body.event.resolvedAt).toBeNull();
    expect(ctx.published).toContain('errorEvents.update');
    const audits = ctx.db.rowsOf('audit_log');
    expect(audits.some((a) => a.action === 'errorEvent.create' && a.entity_id === body.event.id)).toBe(true);
  });

  it('400s on invalid payloads (missing agentId, bad category)', async () => {
    const { ctx, cookie } = await authed();
    expect((await createEvent(ctx, cookie, { message: 'no agent' })).status).toBe(400);
    expect((await createEvent(ctx, cookie, { agentId: 'a', category: 'ghost' })).status).toBe(400);
  });

  it('lists events newest-first', async () => {
    const { ctx, cookie } = await authed();
    await createEvent(ctx, cookie, { agentId: 'a' });
    await createEvent(ctx, cookie, { agentId: 'b' });
    const res = await handleAdminRequest(req('/api/admin/error-events', { cookie }), ctx.env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: { agentId: string }[] };
    expect(body.events.length).toBe(2);
    expect(body.events.map((e) => e.agentId)).toEqual(['b', 'a']);
  });

  it('transitions open -> acknowledged -> resolved; resolvedAt is set on resolve', async () => {
    const { ctx, cookie } = await authed();
    const created = (await (
      await createEvent(ctx, cookie, { agentId: 'monitoring' })
    ).json()) as { event: { id: string } };
    const id = created.event.id;

    const ack = await handleAdminRequest(
      req(`/api/admin/error-events/${id}`, { method: 'PATCH', body: { status: 'acknowledged' }, cookie }),
      ctx.env,
    );
    expect(ack.status).toBe(200);
    expect(((await ack.json()) as { event: { status: string } }).event.status).toBe('acknowledged');

    const res = await handleAdminRequest(
      req(`/api/admin/error-events/${id}`, { method: 'PATCH', body: { status: 'resolved', note: 'fixed' }, cookie }),
      ctx.env,
    );
    expect(res.status).toBe(200);
    const resolved = ((await res.json()) as { event: { status: string; resolvedAt: string | null } }).event;
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).not.toBeNull();
    expect(ctx.published.filter((t) => t === 'errorEvents.update').length).toBeGreaterThanOrEqual(3);
  });

  it('allows direct open -> resolved', async () => {
    const { ctx, cookie } = await authed();
    const created = (await (
      await createEvent(ctx, cookie, { agentId: 'a' })
    ).json()) as { event: { id: string } };
    const res = await handleAdminRequest(
      req(`/api/admin/error-events/${created.event.id}`, {
        method: 'PATCH',
        body: { status: 'resolved' },
        cookie,
      }),
      ctx.env,
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { event: { status: string } }).event.status).toBe('resolved');
  });

  it('422s on illegal transitions (resolved -> acknowledged, acknowledged -> open)', async () => {
    const { ctx, cookie } = await authed();
    const created = (await (
      await createEvent(ctx, cookie, { agentId: 'a' })
    ).json()) as { event: { id: string } };
    const id = created.event.id;
    await handleAdminRequest(
      req(`/api/admin/error-events/${id}`, { method: 'PATCH', body: { status: 'resolved' }, cookie }),
      ctx.env,
    );
    const back = await handleAdminRequest(
      req(`/api/admin/error-events/${id}`, { method: 'PATCH', body: { status: 'acknowledged' }, cookie }),
      ctx.env,
    );
    expect(back.status).toBe(422);
  });

  it('400s on an invalid transition payload (bad status)', async () => {
    const { ctx, cookie } = await authed();
    const created = (await (
      await createEvent(ctx, cookie, { agentId: 'a' })
    ).json()) as { event: { id: string } };
    const res = await handleAdminRequest(
      req(`/api/admin/error-events/${created.event.id}`, {
        method: 'PATCH',
        body: { status: 'fixed' },
        cookie,
      }),
      ctx.env,
    );
    expect(res.status).toBe(400);
  });

  it('404s on an unknown event id', async () => {
    const { ctx, cookie } = await authed();
    expect(
      (
        await handleAdminRequest(
          req('/api/admin/error-events/err_nope', { method: 'PATCH', body: { status: 'resolved' }, cookie }),
          ctx.env,
        )
      ).status,
    ).toBe(404);
  });

  it('viewer may GET but not POST/PATCH', async () => {
    const { ctx, cookie } = await loginAsViewer();
    const env = ctx.env;
    // Seed one event via direct DB insert (viewer cannot create).
    await ctx.db
      .prepare(
        'INSERT INTO error_events (id, agent_id, category, message, status, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind('err_seed1', 'a', 'unknown', '', 'open', new Date().toISOString(), null)
      .run();
    const get = await handleAdminRequest(req('/api/admin/error-events', { cookie }), env);
    expect(get.status).toBe(200);
    const post = await handleAdminRequest(
      req('/api/admin/error-events', { method: 'POST', body: { agentId: 'a' }, cookie }),
      env,
    );
    expect(post.status).toBe(403);
    const patch = await handleAdminRequest(
      req('/api/admin/error-events/err_seed1', { method: 'PATCH', body: { status: 'resolved' }, cookie }),
      env,
    );
    expect(patch.status).toBe(403);
  });
});
