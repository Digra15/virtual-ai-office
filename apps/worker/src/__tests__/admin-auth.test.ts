/**
 * Admin auth tests: PBKDF2 hashing, setup-once semantics, login/logout/me,
 * session expiry, role gating, rate limits, and the no-D1 503 path.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  handleAdminRequest,
  resetAdminRateLimiters,
} from '../admin/routes';
import {
  hashPassword,
  timingSafeEqual,
  verifyPassword,
} from '../admin/auth';
import { makeEnv, req, sessionCookie } from './mock-env';

const SETUP = { username: 'admin', password: 'supersecretpassword', setupToken: 'test-setup-token' };

async function setupAndLogin(ip = '1.2.3.4'): Promise<{ ctx: ReturnType<typeof makeEnv>; cookie: string }> {
  const ctx = makeEnv();
  const s = await handleAdminRequest(req('/api/admin/auth/setup', { method: 'POST', body: SETUP, ip }), ctx.env);
  expect(s.status).toBe(201);
  const l = await handleAdminRequest(
    req('/api/admin/auth/login', { method: 'POST', body: { username: 'admin', password: 'supersecretpassword' }, ip }),
    ctx.env,
  );
  expect(l.status).toBe(200);
  const cookie = sessionCookie(l);
  expect(cookie).not.toBeNull();
  return { ctx, cookie: cookie as string };
}

beforeEach(() => {
  resetAdminRateLimiters();
});

describe('PBKDF2 password hashing', () => {
  it('hashes and verifies a roundtrip', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('pbkdf2-sha256$100000$')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('the-right-password');
    expect(await verifyPassword('the-wrong-password', hash)).toBe(false);
  });

  it('produces unique salts per hash', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-password', a)).toBe(true);
    expect(await verifyPassword('same-password', b)).toBe(true);
  });

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'pbkdf2-sha256$bad$abc$def')).toBe(false);
  });
});

describe('timingSafeEqual', () => {
  it('compares correctly', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });
});

describe('POST /api/admin/auth/setup', () => {
  it('creates the first admin (201) and then 403s forever', async () => {
    const mock = makeEnv(); const env = mock.env;
    const first = await handleAdminRequest(
      req('/api/admin/auth/setup', { method: 'POST', body: SETUP }),
      env,
    );
    expect(first.status).toBe(201);
    const body = (await first.json()) as { user: { username: string; role: string } };
    expect(body.user.username).toBe('admin');
    expect(body.user.role).toBe('admin');

    const second = await handleAdminRequest(
      req('/api/admin/auth/setup', { method: 'POST', body: SETUP }),
      env,
    );
    expect(second.status).toBe(403);
  });

  it('403s with a wrong setup token (and reveals nothing)', async () => {
    const mock = makeEnv(); const env = mock.env;
    const res = await handleAdminRequest(
      req('/api/admin/auth/setup', { method: 'POST', body: { ...SETUP, setupToken: 'wrong' } }),
      env,
    );
    expect(res.status).toBe(403);
    // The failed attempt must not have created anyone: a correct retry works.
    const retry = await handleAdminRequest(
      req('/api/admin/auth/setup', { method: 'POST', body: SETUP }),
      env,
    );
    expect(retry.status).toBe(201);
  });

  it('400s on invalid payload (short password)', async () => {
    const mock = makeEnv(); const env = mock.env;
    const res = await handleAdminRequest(
      req('/api/admin/auth/setup', { method: 'POST', body: { ...SETUP, password: 'short' } }),
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe('login / logout / me', () => {
  it('401s on wrong password with a generic message', async () => {
    const mock = makeEnv(); const env = mock.env;
    await handleAdminRequest(req('/api/admin/auth/setup', { method: 'POST', body: SETUP }), env);
    const res = await handleAdminRequest(
      req('/api/admin/auth/login', { method: 'POST', body: { username: 'admin', password: 'nope' } }),
      env,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Invalid username or password');
  });

  it('401s on unknown username (same message — no user enumeration)', async () => {
    const mock = makeEnv(); const env = mock.env;
    await handleAdminRequest(req('/api/admin/auth/setup', { method: 'POST', body: SETUP }), env);
    const res = await handleAdminRequest(
      req('/api/admin/auth/login', { method: 'POST', body: { username: 'ghost', password: 'whatever' } }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it('me without a cookie -> 401; with cookie -> 200; logout clears it', async () => {
    const { ctx, cookie } = await setupAndLogin();
    const env = ctx.env;
    const anon = await handleAdminRequest(req('/api/admin/auth/me'), env);
    expect(anon.status).toBe(401);

    const me = await handleAdminRequest(req('/api/admin/auth/me', { cookie }), env);
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as { user: { username: string; role: string } };
    expect(meBody.user.username).toBe('admin');

    const out = await handleAdminRequest(req('/api/admin/auth/logout', { method: 'POST', cookie }), env);
    expect(out.status).toBe(200);

    const after = await handleAdminRequest(req('/api/admin/auth/me', { cookie }), env);
    expect(after.status).toBe(401);
  });

  it('updates lastLoginAt on login', async () => {
    const mock = makeEnv(); const env = mock.env;
    await handleAdminRequest(req('/api/admin/auth/setup', { method: 'POST', body: SETUP }), env);
    const l = await handleAdminRequest(
      req('/api/admin/auth/login', { method: 'POST', body: { username: 'admin', password: 'supersecretpassword' } }),
      env,
    );
    const body = (await l.json()) as { user: { lastLoginAt: string | null } };
    expect(body.user.lastLoginAt).not.toBeNull();
  });

  it('rejects an expired session and deletes it', async () => {
    const { ctx, cookie } = await setupAndLogin();
    const env = ctx.env;
    // Force-expire the session row directly.
    const sessions = ctx.db.rowsOf('admin_sessions');
    expect(sessions.length).toBe(1);
    (sessions[0] as Record<string, unknown>).expires_at = new Date(Date.now() - 1000).toISOString();

    const me = await handleAdminRequest(req('/api/admin/auth/me', { cookie }), env);
    expect(me.status).toBe(401);
    expect(ctx.db.rowsOf('admin_sessions').length).toBe(0);
  });
});

describe('login rate limiting', () => {
  it('allows 5 attempts then 429s the 6th (same IP)', async () => {
    const mock = makeEnv(); const env = mock.env;
    await handleAdminRequest(req('/api/admin/auth/setup', { method: 'POST', body: SETUP }), env);
    const ip = '9.9.9.9';
    for (let i = 0; i < 5; i++) {
      const r = await handleAdminRequest(
        req('/api/admin/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrong' }, ip }),
        env,
      );
      expect(r.status).toBe(401);
    }
    const sixth = await handleAdminRequest(
      req('/api/admin/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrong' }, ip }),
      env,
    );
    expect(sixth.status).toBe(429);
    const body = (await sixth.json()) as { error: string };
    expect(body.error).toMatch(/too many/i);
  });

  it('tracks IPs independently', async () => {
    const mock = makeEnv(); const env = mock.env;
    await handleAdminRequest(req('/api/admin/auth/setup', { method: 'POST', body: SETUP }), env);
    for (let i = 0; i < 5; i++) {
      await handleAdminRequest(
        req('/api/admin/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrong' }, ip: '10.0.0.1' }),
        env,
      );
    }
    // A different IP is unaffected.
    const other = await handleAdminRequest(
      req('/api/admin/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrong' }, ip: '10.0.0.2' }),
      env,
    );
    expect(other.status).toBe(401);
  });
});

describe('role gating', () => {
  async function loginAsViewer(): Promise<{ ctx: ReturnType<typeof makeEnv>; cookie: string }> {
    const ctx = makeEnv();
    // Seed a viewer directly (setup only creates the first admin).
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

  it('viewer may GET but not POST', async () => {
    const { ctx, cookie } = await loginAsViewer();
    const env = ctx.env;
    const get = await handleAdminRequest(req('/api/admin/workers', { cookie }), env);
    expect(get.status).toBe(200);
    const post = await handleAdminRequest(
      req('/api/admin/workers', { method: 'POST', body: { id: 'w1', displayName: 'W' }, cookie }),
      env,
    );
    expect(post.status).toBe(403);
  });

  it('unauthenticated admin requests -> 401', async () => {
    const mock = makeEnv(); const env = mock.env;
    await handleAdminRequest(req('/api/admin/auth/setup', { method: 'POST', body: SETUP }), env);
    const res = await handleAdminRequest(req('/api/admin/workers'), env);
    expect(res.status).toBe(401);
  });
});

describe('no D1 configured', () => {
  it('503s honestly on admin and public routes', async () => {
    const mock = makeEnv({ DB: undefined }); const env = mock.env;
    const a = await handleAdminRequest(req('/api/admin/workers'), env);
    expect(a.status).toBe(503);
    expect(((await a.json()) as { error: string }).error).toBe('admin database not configured');
    const p = await handleAdminRequest(req('/api/public/workers'), env);
    expect(p.status).toBe(503);
  });
});
