/**
 * Shared test scaffolding for the admin API tests: mock Env (D1 + R2 +
 * fake AGENT_ROOM that records broadcasts), request builder, cookie helper.
 */
import type { Env } from '../env';
import { MockD1 } from './mock-d1';

export interface MockEnv {
  env: Env;
  db: MockD1;
  r2: Map<string, { body: unknown; contentType?: string }>;
  published: string[];
}

export function makeEnv(overrides?: Record<string, unknown>): MockEnv {
  const db = new MockD1();
  const r2 = new Map<string, { body: unknown; contentType?: string }>();
  const published: string[] = [];

  const mockR2 = {
    put: async (key: string, value: unknown, opts?: { httpMetadata?: { contentType?: string } }) => {
      r2.set(key, { body: value, contentType: opts?.httpMetadata?.contentType });
    },
    delete: async (key: string) => {
      r2.delete(key);
    },
  };
  const mockRoom = {
    idFromName: (_name: string) => 'global',
    get: (_id: unknown) => ({
      fetch: async (req: Request) => {
        const body = (await req.json()) as { type: string };
        published.push(body.type);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    }),
  };

  const env = {
    AGENT_ROOM: mockRoom,
    DB: db,
    ASSETS: mockR2,
    SETUP_TOKEN: 'test-setup-token',
    INTERNAL_SECRET: 'test-internal-secret',
    ...(overrides ?? {}),
  } as unknown as Env;
  return { env, db, r2, published };
}

export interface ReqOpts {
  method?: string;
  body?: unknown;
  cookie?: string;
  ip?: string;
  form?: FormData;
}

export function req(path: string, opts: ReqOpts = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  headers['CF-Connecting-IP'] = opts.ip ?? '1.2.3.4';
  const init: RequestInit = { method: opts.method ?? 'GET', headers };
  if (opts.form) {
    init.body = opts.form;
  } else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  return new Request(`https://test${path}`, init);
}

/** Extract the `vao_admin_session=<token>` cookie pair from a login response. */
export function sessionCookie(res: Response): string | null {
  const set = res.headers.get('set-cookie');
  if (!set) return null;
  const m = set.match(/vao_admin_session=([^;]*)/);
  return m ? `vao_admin_session=${m[1]}` : null;
}
