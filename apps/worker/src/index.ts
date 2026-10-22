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
import type { Env } from './env';

export { AgentRoom };

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
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
      );
    }

    const id = env.AGENT_ROOM.idFromName('global');
    const stub = env.AGENT_ROOM.get(id);
    // Forward the original request (preserves Upgrade + CF-Connecting-IP).
    const res = await stub.fetch(request);
    // A 101 upgrade carries its WebSocket on the Response object itself —
    // rebuilding it (e.g. to add headers) would drop the socket.
    if (res.status === 101) return res;
    return withCors(res);
  },
};
