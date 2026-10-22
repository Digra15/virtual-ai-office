/**
 * Admin CRUD tests: workers, services, orders (+transitions/payment),
 * office config, assets (mock R2), audit log, and the public storefront API.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { handleAdminRequest, resetAdminRateLimiters } from '../admin/routes';
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

async function createService(ctx: MockEnv, cookie: string, body: Record<string, unknown>) {
  return handleAdminRequest(req('/api/admin/services', { method: 'POST', body, cookie }), ctx.env);
}

function pngForm(name: string, type: string, bytes: Uint8Array, extra: Record<string, string> = {}): FormData {
  const f = new FormData();
  f.append('file', new File([bytes], name, { type }));
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  return f;
}

beforeEach(() => {
  resetAdminRateLimiters();
});

describe('workers CRUD', () => {
  it('creates, reads, and lists a worker; broadcasts workers.update', async () => {
    const { ctx, cookie } = await authed();
    const res = await handleAdminRequest(
      req('/api/admin/workers', {
        method: 'POST',
        cookie,
        body: { id: 'nika', displayName: 'Nika', role: 'assistant', agentSource: 'agent-123', accentColor: '#ff0000' },
      }),
      ctx.env,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { worker: { id: string; displayName: string; agentSource: string } };
    expect(body.worker.id).toBe('nika');
    expect(body.worker.agentSource).toBe('agent-123');
    expect(ctx.published).toContain('workers.update');

    const get = await handleAdminRequest(req('/api/admin/workers/nika', { cookie }), ctx.env);
    expect(get.status).toBe(200);
    const list = (await (
      await handleAdminRequest(req('/api/admin/workers', { cookie }), ctx.env)
    ).json()) as { workers: unknown[] };
    expect(list.workers.length).toBe(1);
  });

  it('409s on duplicate id', async () => {
    const { ctx, cookie } = await authed();
    const payload = { id: 'nika', displayName: 'Nika' };
    expect((await handleAdminRequest(req('/api/admin/workers', { method: 'POST', body: payload, cookie }), ctx.env)).status).toBe(201);
    const dup = await handleAdminRequest(req('/api/admin/workers', { method: 'POST', body: payload, cookie }), ctx.env);
    expect(dup.status).toBe(409);
  });

  it('404s on unknown worker', async () => {
    const { ctx, cookie } = await authed();
    expect((await handleAdminRequest(req('/api/admin/workers/ghost', { cookie }), ctx.env)).status).toBe(404);
    expect(
      (await handleAdminRequest(req('/api/admin/workers/ghost', { method: 'PUT', body: {}, cookie }), ctx.env)).status,
    ).toBe(404);
  });

  it('PUT renames (displayName only) and keeps the id; strips id/agentSource', async () => {
    const { ctx, cookie } = await authed();
    await handleAdminRequest(
      req('/api/admin/workers', { method: 'POST', body: { id: 'nika', displayName: 'Nika', agentSource: 'agent-123' }, cookie }),
      ctx.env,
    );
    const put = await handleAdminRequest(
      req('/api/admin/workers/nika', {
        method: 'PUT',
        cookie,
        body: { displayName: 'Nika Prime', id: 'hacked', agentSource: 'evil-agent' },
      }),
      ctx.env,
    );
    expect(put.status).toBe(200);
    const body = (await put.json()) as { worker: { id: string; displayName: string; agentSource: string } };
    expect(body.worker.id).toBe('nika');
    expect(body.worker.displayName).toBe('Nika Prime');
    expect(body.worker.agentSource).toBe('agent-123');
    // Raw DB row confirms identity columns were never touched.
    const rows = ctx.db.rowsOf('workers');
    expect(rows[0]?.id).toBe('nika');
    expect(rows[0]?.agent_source).toBe('agent-123');
  });

  it('400s on invalid payloads (bad hex color, bad enum)', async () => {
    const { ctx, cookie } = await authed();
    const badColor = await handleAdminRequest(
      req('/api/admin/workers', { method: 'POST', body: { id: 'w1', displayName: 'W', accentColor: 'red' }, cookie }),
      ctx.env,
    );
    expect(badColor.status).toBe(400);
    const badRole = await handleAdminRequest(
      req('/api/admin/workers', { method: 'POST', body: { id: 'w2', displayName: 'W', role: 'bogus' }, cookie }),
      ctx.env,
    );
    expect(badRole.status).toBe(400);
    const badPut = await handleAdminRequest(
      req('/api/admin/workers', { method: 'POST', body: { id: 'w3', displayName: 'W' }, cookie }),
      ctx.env,
    );
    expect(badPut.status).toBe(201);
    const putBad = await handleAdminRequest(
      req('/api/admin/workers/w3', { method: 'PUT', body: { accentColor: '#zzz' }, cookie }),
      ctx.env,
    );
    expect(putBad.status).toBe(400);
  });

  it('DELETE archives (soft); archived workers stay in the DB', async () => {
    const { ctx, cookie } = await authed();
    await handleAdminRequest(
      req('/api/admin/workers', { method: 'POST', body: { id: 'nika', displayName: 'Nika' }, cookie }),
      ctx.env,
    );
    const del = await handleAdminRequest(req('/api/admin/workers/nika', { method: 'DELETE', cookie }), ctx.env);
    expect(del.status).toBe(200);
    expect(((await del.json()) as { worker: { archived: boolean } }).worker.archived).toBe(true);
    // Raw row still exists, flagged archived.
    expect(ctx.db.rowsOf('workers').length).toBe(1);
    expect(ctx.db.rowsOf('workers')[0]?.archived).toBe(1);

    const list = (await (await handleAdminRequest(req('/api/admin/workers', { cookie }), ctx.env)).json()) as {
      workers: unknown[];
    };
    expect(list.workers.length).toBe(0);
    const withArchived = (await (
      await handleAdminRequest(req('/api/admin/workers?includeArchived=1', { cookie }), ctx.env)
    ).json()) as { workers: unknown[] };
    expect(withArchived.workers.length).toBe(1);

    const restore = await handleAdminRequest(req('/api/admin/workers/nika/restore', { method: 'POST', cookie }), ctx.env);
    expect(restore.status).toBe(200);
    expect(((await restore.json()) as { worker: { archived: boolean } }).worker.archived).toBe(false);
  });

  it('DELETE on unknown worker -> 404', async () => {
    const { ctx, cookie } = await authed();
    expect((await handleAdminRequest(req('/api/admin/workers/nope', { method: 'DELETE', cookie }), ctx.env)).status).toBe(404);
  });
});

describe('public workers', () => {
  it('excludes archived/non-public workers and never leaks agentSource', async () => {
    const { ctx, cookie } = await authed();
    const post = (body: Record<string, unknown>) =>
      handleAdminRequest(req('/api/admin/workers', { method: 'POST', body, cookie }), ctx.env);
    await post({ id: 'pub', displayName: 'Public', agentSource: 'secret-agent-1' });
    await post({ id: 'priv', displayName: 'Private', publicVisible: false, agentSource: 'secret-agent-2' });
    await post({ id: 'old', displayName: 'Old', agentSource: 'secret-agent-3' });
    await handleAdminRequest(req('/api/admin/workers/old', { method: 'DELETE', cookie }), ctx.env);

    const res = await handleAdminRequest(req('/api/public/workers'), ctx.env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { workers: Array<Record<string, unknown>> };
    expect(body.workers.map((w) => w.id)).toEqual(['pub']);
    for (const w of body.workers) {
      expect('agentSource' in w).toBe(false);
      expect('agent_source' in w).toBe(false);
    }
    expect(JSON.stringify(body)).not.toContain('secret-agent');
  });
});

describe('services CRUD', () => {
  it('creates, updates, hard-deletes; public lists published only with workerName', async () => {
    const { ctx, cookie } = await authed();
    await handleAdminRequest(
      req('/api/admin/workers', { method: 'POST', body: { id: 'nika', displayName: 'Nika' }, cookie }),
      ctx.env,
    );
    const c1 = await createService(ctx, cookie, { id: 'svc-draft', title: 'Draft', status: 'draft' });
    expect(c1.status).toBe(201);
    const c2 = await createService(ctx, cookie, { id: 'svc-live', title: 'Live', status: 'published', workerId: 'nika', price: 50 });
    expect(c2.status).toBe(201);
    expect(ctx.published).toContain('services.update');

    const dup = await createService(ctx, cookie, { id: 'svc-live', title: 'Dup' });
    expect(dup.status).toBe(409);

    const put = await handleAdminRequest(
      req('/api/admin/services/svc-live', { method: 'PUT', body: { title: 'Live v2' }, cookie }),
      ctx.env,
    );
    expect(put.status).toBe(200);
    expect(((await put.json()) as { service: { title: string; id: string } }).service.title).toBe('Live v2');

    const pub = (await (await handleAdminRequest(req('/api/public/services'), ctx.env)).json()) as {
      services: Array<{ id: string; workerName: string | null; status: string }>;
    };
    expect(pub.services.map((s) => s.id)).toEqual(['svc-live']);
    expect(pub.services[0]?.workerName).toBe('Nika');

    const del = await handleAdminRequest(req('/api/admin/services/svc-draft', { method: 'DELETE', cookie }), ctx.env);
    expect(del.status).toBe(200);
    expect(ctx.db.rowsOf('services').length).toBe(1); // hard delete
    expect((await handleAdminRequest(req('/api/admin/services/svc-draft', { cookie }), ctx.env)).status).toBe(404);
    expect((await handleAdminRequest(req('/api/admin/services/svc-draft', { method: 'DELETE', cookie }), ctx.env)).status).toBe(404);
  });
});

describe('orders', () => {
  async function seedService(ctx: MockEnv, cookie: string) {
    const r = await createService(ctx, cookie, { id: 'svc1', title: 'Design' });
    expect(r.status).toBe(201);
  }

  it('creates with auto id, 404s on unknown service', async () => {
    const { ctx, cookie } = await authed();
    await seedService(ctx, cookie);
    const res = await handleAdminRequest(
      req('/api/admin/orders', { method: 'POST', body: { serviceId: 'svc1', customerName: 'Ayu' }, cookie }),
      ctx.env,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { order: { id: string; status: string; paid: boolean } };
    expect(body.order.id).toMatch(/^ord_[0-9a-f]{24}$/);
    expect(body.order.status).toBe('pending');
    expect(body.order.paid).toBe(false);

    const bad = await handleAdminRequest(
      req('/api/admin/orders', { method: 'POST', body: { serviceId: 'nope' }, cookie }),
      ctx.env,
    );
    expect(bad.status).toBe(404);
  });

  it('accepts explicit ids and 409s on duplicates', async () => {
    const { ctx, cookie } = await authed();
    await seedService(ctx, cookie);
    const r1 = await handleAdminRequest(
      req('/api/admin/orders', { method: 'POST', body: { id: 'my-order', serviceId: 'svc1' }, cookie }),
      ctx.env,
    );
    expect(r1.status).toBe(201);
    const r2 = await handleAdminRequest(
      req('/api/admin/orders', { method: 'POST', body: { id: 'my-order', serviceId: 'svc1' }, cookie }),
      ctx.env,
    );
    expect(r2.status).toBe(409);
  });

  it('pending -> accepted ok; pending -> completed -> 422', async () => {
    const { ctx, cookie } = await authed();
    await seedService(ctx, cookie);
    const mk = async () =>
      (
        (await (
          await handleAdminRequest(req('/api/admin/orders', { method: 'POST', body: { serviceId: 'svc1' }, cookie }), ctx.env)
        ).json()) as { order: { id: string } }
      ).order.id;
    const id1 = await mk();
    const t1 = await handleAdminRequest(
      req(`/api/admin/orders/${id1}/transition`, { method: 'POST', body: { to: 'accepted', note: 'ok' }, cookie }),
      ctx.env,
    );
    expect(t1.status).toBe(200);
    expect(((await t1.json()) as { order: { status: string } }).order.status).toBe('accepted');

    const id2 = await mk();
    const t2 = await handleAdminRequest(
      req(`/api/admin/orders/${id2}/transition`, { method: 'POST', body: { to: 'completed' }, cookie }),
      ctx.env,
    );
    expect(t2.status).toBe(422);
  });

  it('failed -> queued ok; completing sets completedAt', async () => {
    const { ctx, cookie } = await authed();
    await seedService(ctx, cookie);
    const id = (
      (await (
        await handleAdminRequest(req('/api/admin/orders', { method: 'POST', body: { serviceId: 'svc1' }, cookie }), ctx.env)
      ).json()) as { order: { id: string } }
    ).order.id;
    const go = (to: string) =>
      handleAdminRequest(req(`/api/admin/orders/${id}/transition`, { method: 'POST', body: { to }, cookie }), ctx.env);
    for (const to of ['accepted', 'queued', 'in_progress', 'failed']) {
      expect((await go(to)).status).toBe(200);
    }
    expect((await go('queued')).status).toBe(200);
    for (const to of ['in_progress', 'review', 'completed']) {
      expect((await go(to)).status).toBe(200);
    }
    const done = (await (await handleAdminRequest(req(`/api/admin/orders/${id}`, { cookie }), ctx.env)).json()) as {
      order: { status: string; completedAt: string | null };
    };
    expect(done.order.status).toBe('completed');
    expect(done.order.completedAt).not.toBeNull();
    // Terminal: no outgoing transitions.
    expect((await go('queued')).status).toBe(422);
  });

  it('payment endpoint sets paid; normal transitions can never set paid', async () => {
    const { ctx, cookie } = await authed();
    await seedService(ctx, cookie);
    const mk = async () =>
      (
        (await (
          await handleAdminRequest(req('/api/admin/orders', { method: 'POST', body: { serviceId: 'svc1' }, cookie }), ctx.env)
        ).json()) as { order: { id: string } }
      ).order.id;

    const id1 = await mk();
    // Sneaky: try to flip paid via the transition endpoint.
    const sneak = await handleAdminRequest(
      req(`/api/admin/orders/${id1}/transition`, { method: 'POST', body: { to: 'accepted', paid: true }, cookie }),
      ctx.env,
    );
    expect(sneak.status).toBe(200);
    expect(((await sneak.json()) as { order: { paid: boolean } }).order.paid).toBe(false);

    const pay = await handleAdminRequest(
      req(`/api/admin/orders/${id1}/payment`, {
        method: 'POST',
        body: { provider: 'stripe', providerRef: 'pi_123' },
        cookie,
      }),
      ctx.env,
    );
    expect(pay.status).toBe(200);
    const paid = ((await pay.json()) as { order: { paid: boolean; paymentRef: string } }).order;
    expect(paid.paid).toBe(true);
    expect(paid.paymentRef).toBe('pi_123');

    const again = await handleAdminRequest(
      req(`/api/admin/orders/${id1}/payment`, { method: 'POST', body: { provider: 'stripe', providerRef: 'pi_999' }, cookie }),
      ctx.env,
    );
    expect(again.status).toBe(409);
  });

  it('payment validates payload and 404s on unknown order', async () => {
    const { ctx, cookie } = await authed();
    expect(
      (await handleAdminRequest(req('/api/admin/orders/ghost/payment', { method: 'POST', body: { provider: 'x', providerRef: 'y' }, cookie }), ctx.env)).status,
    ).toBe(404);
    await seedService(ctx, cookie);
    const id = (
      (await (
        await handleAdminRequest(req('/api/admin/orders', { method: 'POST', body: { serviceId: 'svc1' }, cookie }), ctx.env)
      ).json()) as { order: { id: string } }
    ).order.id;
    const bad = await handleAdminRequest(
      req(`/api/admin/orders/${id}/payment`, { method: 'POST', body: { provider: 'stripe' }, cookie }),
      ctx.env,
    );
    expect(bad.status).toBe(400);
  });
});

describe('office config', () => {
  it('PUT validates key and value; GET returns all; broadcasts config.update', async () => {
    const { ctx, cookie } = await authed();
    const unknown = await handleAdminRequest(
      req('/api/admin/config/office.nope', { method: 'PUT', body: { value: {} }, cookie }),
      ctx.env,
    );
    expect(unknown.status).toBe(400);

    const badValue = await handleAdminRequest(
      req('/api/admin/config/office.theme', { method: 'PUT', body: { value: 'neon' }, cookie }),
      ctx.env,
    );
    expect(badValue.status).toBe(400);

    const ok = await handleAdminRequest(
      req('/api/admin/config/office.branding', { method: 'PUT', body: { value: { officeName: 'Acme Office' } }, cookie }),
      ctx.env,
    );
    expect(ok.status).toBe(200);
    expect(ctx.published).toContain('config.update');

    const theme = await handleAdminRequest(
      req('/api/admin/config/office.theme', { method: 'PUT', body: { value: 'dawn' }, cookie }),
      ctx.env,
    );
    expect(theme.status).toBe(200);

    const list = (await (await handleAdminRequest(req('/api/admin/config', { cookie }), ctx.env)).json()) as {
      config: Record<string, { officeName: string }>;
    };
    expect(list.config['office.branding']?.officeName).toBe('Acme Office');
  });

  it('public config returns only the storefront keys with 404-safe defaults', async () => {
    const { env } = makeEnv();
    const res = await handleAdminRequest(req('/api/public/config'), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      branding: { officeName: string };
      theme: string;
      visibility: { publicScene: boolean };
      camera: { fov: number };
    };
    expect(body.branding.officeName).toBe('Virtual AI Office');
    expect(body.theme).toBe('midnight');
    expect(body.visibility.publicScene).toBe(true);
    expect(body.camera.fov).toBe(45);
    expect('rooms' in body).toBe(false);
  });
});

describe('audit log', () => {
  it('records mutations with actor/action/entity and honors limit', async () => {
    const { ctx, cookie } = await authed();
    await handleAdminRequest(
      req('/api/admin/workers', { method: 'POST', body: { id: 'nika', displayName: 'Nika' }, cookie }),
      ctx.env,
    );
    await handleAdminRequest(req('/api/admin/workers/nika', { method: 'DELETE', cookie }), ctx.env);

    const res = await handleAdminRequest(req('/api/admin/audit?limit=50', { cookie }), ctx.env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entries: Array<{ actor: string; action: string; entity: string; entityId: string; at: string }>;
    };
    const actions = body.entries.map((e) => e.action);
    expect(actions).toContain('worker.create');
    expect(actions).toContain('worker.archive');
    expect(actions).toContain('admin.login');
    const create = body.entries.find((e) => e.action === 'worker.create');
    expect(create?.actor).toBe('admin');
    expect(create?.entity).toBe('worker');
    expect(create?.entityId).toBe('nika');

    const one = (await (await handleAdminRequest(req('/api/admin/audit?limit=1', { cookie }), ctx.env)).json()) as {
      entries: unknown[];
    };
    expect(one.entries.length).toBe(1);
  });
});

describe('assets', () => {
  const tiny = new Uint8Array([0x47, 0x4c, 0x42]); // "GLB" magic-ish

  it('503s without an R2 binding', async () => {
    const ctx = makeEnv({ ASSETS: undefined });
    const s = await handleAdminRequest(req('/api/admin/auth/setup', { method: 'POST', body: SETUP }), ctx.env);
    expect(s.status).toBe(201);
    const l = await handleAdminRequest(
      req('/api/admin/auth/login', { method: 'POST', body: { username: 'admin', password: 'supersecretpassword' } }),
      ctx.env,
    );
    const cookie = sessionCookie(l) as string;
    const up = await handleAdminRequest(
      req('/api/admin/assets', { method: 'POST', form: pngForm('m.png', 'image/png', tiny), cookie }),
      ctx.env,
    );
    expect(up.status).toBe(503);
  });

  it('413s oversize files', async () => {
    const { ctx, cookie } = await authed();
    const big = new Uint8Array(6 * 1024 * 1024);
    const res = await handleAdminRequest(
      req('/api/admin/assets', { method: 'POST', form: pngForm('big.png', 'image/png', big), cookie }),
      ctx.env,
    );
    expect(res.status).toBe(413);
  });

  it('400s on bad extension or MIME', async () => {
    const { ctx, cookie } = await authed();
    const badExt = await handleAdminRequest(
      req('/api/admin/assets', { method: 'POST', form: pngForm('evil.exe', 'image/png', tiny), cookie }),
      ctx.env,
    );
    expect(badExt.status).toBe(400);
    const badMime = await handleAdminRequest(
      req('/api/admin/assets', { method: 'POST', form: pngForm('m.png', 'application/octet-stream', tiny), cookie }),
      ctx.env,
    );
    expect(badMime.status).toBe(400);
  });

  it('uploads to R2, records the manifest, lists, and deletes', async () => {
    const { ctx, cookie } = await authed();
    const up = await handleAdminRequest(
      req('/api/admin/assets', {
        method: 'POST',
        cookie,
        form: pngForm('Hero Sheet.png', 'image/png', tiny, {
          attribution: 'Test Artist',
          license: 'CC0',
          animations: JSON.stringify({ idle: 2, walking: 4 }),
          frameWidth: '28',
          frameHeight: '36',
        }),
      }),
      ctx.env,
    );
    expect(up.status).toBe(201);
    const body = (await up.json()) as {
      asset: { id: string; url: string; kind: string; attribution: string; animations: Record<string, number>; frameWidth: number; frameHeight: number };
      publicUrlConfigured: boolean;
    };
    expect(body.asset.id).toBe('hero-sheet');
    expect(body.publicUrlConfigured).toBe(false);
    expect(body.asset.url).toBe('characters/hero-sheet.png');
    expect(body.asset.kind).toBe('png');
    expect(body.asset.animations).toEqual({ idle: 2, walking: 4 });
    expect(body.asset.frameWidth).toBe(28);
    expect(body.asset.frameHeight).toBe(36);
    expect(ctx.r2.has('characters/hero-sheet.png')).toBe(true);
    expect(ctx.r2.get('characters/hero-sheet.png')?.contentType).toBe('image/png');
    expect(ctx.db.rowsOf('asset_manifest').length).toBe(1);

    const dup = await handleAdminRequest(
      req('/api/admin/assets', { method: 'POST', form: pngForm('Hero Sheet.png', 'image/png', tiny), cookie }),
      ctx.env,
    );
    expect(dup.status).toBe(409);

    const list = (await (await handleAdminRequest(req('/api/admin/assets', { cookie }), ctx.env)).json()) as {
      assets: unknown[];
    };
    expect(list.assets.length).toBe(1);

    const del = await handleAdminRequest(req('/api/admin/assets/hero-sheet', { method: 'DELETE', cookie }), ctx.env);
    expect(del.status).toBe(200);
    expect(ctx.r2.has('characters/hero-sheet.png')).toBe(false);
    expect(ctx.db.rowsOf('asset_manifest').length).toBe(0);
    expect((await handleAdminRequest(req('/api/admin/assets/hero-sheet', { method: 'DELETE', cookie }), ctx.env)).status).toBe(404);
  });
});
