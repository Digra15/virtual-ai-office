/**
 * Cloudflare Worker entrypoint — thin router + CORS layer.
 *
 * ALL agent state lives in the `AgentRoom` Durable Object singleton
 * (`idFromName("global")`). This fetch handler only:
 *   1. answers CORS preflights,
 *   2. forwards `/health`, `/api/*` and `/ws` to the Durable Object,
 *   3. stamps CORS headers on the way back.
 *
 * Exported for `wrangler dev` / `wrangler deploy` (see wrangler.toml).
 */
import { AgentRoom } from './room';
import { handleAdminRequest } from './admin/routes';
import type { Env } from './env';

export { AgentRoom };

/**
 * CORS policy.
 *
 * The admin UI (Cloudflare Pages) calls this API cross-site with
 * `credentials: "include"` so the HttpOnly session cookie is sent. Browsers
 * reject credentialed requests against `access-control-allow-origin: *`, so
 * when the request Origin matches the configured ADMIN_ORIGIN we echo that
 * exact origin back with `allow-credentials: true`.
 *
 * Set ADMIN_ORIGIN to the Pages URL, e.g.
 *   https://virtual-ai-office.pages.dev
 * via `wrangler secret put ADMIN_ORIGIN` or [vars]. Without it, the API
 * still works for non-credentialed callers (public endpoints, curl).
 */
function corsHeadersFor(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowed = (env.ADMIN_ORIGIN ?? '').trim();
  if (allowed && origin === allowed) {
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
      vary: 'Origin',
    };
  }
  return { ...CORS_HEADERS };
}

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

function withCors(res: Response, cors: Record<string, string>): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeadersFor(request, env);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Admin panel + public storefront API live in the Worker itself (D1/R2),
    // never in the Durable Object. Intercepted here so they skip the DO hop.
    const isAdminApi =
      pathname === '/api/admin' ||
      pathname.startsWith('/api/admin/') ||
      pathname === '/api/public' ||
      pathname.startsWith('/api/public/');
    if (isAdminApi) {
      try {
        return withCors(await handleAdminRequest(request, env), cors);
      } catch (e) {
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        return withCors(
          new Response(JSON.stringify({ error: `Admin API failure: ${msg}` }), {
            status: 500,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          }),
          cors,
        );
      }
    }

    const known =
      pathname === '/health' ||
      pathname === '/ws' ||
      pathname.startsWith('/api/');

    if (!known) {
      return withCors(
        new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        }),
        cors,
      );
    }

    const id = env.AGENT_ROOM.idFromName('global');
    const stub = env.AGENT_ROOM.get(id);
    // Forward the original request (preserves Upgrade + CF-Connecting-IP).
    const res = await stub.fetch(request);
    // A 101 upgrade carries its WebSocket on the Response object itself —
    // rebuilding it (e.g. to add headers) would drop the socket.
    if (res.status === 101) return res;
    return withCors(res, cors);
  },
};
