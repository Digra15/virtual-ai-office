/**
 * Worker environment: Durable Object binding + `[vars]` from wrangler.toml.
 * All vars arrive as strings; parsed where used.
 */
export interface Env {
  AGENT_ROOM: DurableObjectNamespace;
  DEMO_MODE?: string;
  OFFLINE_TIMEOUT_MS?: string;
  RATE_LIMIT_PER_MINUTE?: string;
  /**
   * D1 database backing the admin panel (workers/services/orders/config/
   * audit/assets). OPTIONAL: when unbound, /api/admin/* and /api/public/*
   * answer 503 {error:'admin database not configured'} instead of crashing.
   */
  DB?: D1Database;
  /**
   * R2 bucket for character sprite-sheet uploads (.png). OPTIONAL: asset
   * upload/delete answers 503 when unbound.
   */
  ASSETS?: R2Bucket;
  /**
   * One-time token authorizing POST /api/admin/auth/setup. Set via
   * `npx wrangler secret put SETUP_TOKEN`. NEVER commit a real value.
   */
  SETUP_TOKEN?: string;
  /**
   * Shared secret the Worker uses to call the DO's POST /__internal/publish.
   * Set via `npx wrangler secret put INTERNAL_SECRET`. NEVER commit a real value.
   */
  INTERNAL_SECRET?: string;
  /**
   * Shared secret agents use to authenticate event + task reports
   * (`Authorization: Bearer <AGENT_SECRET>`). Set via
   * `npx wrangler secret put AGENT_SECRET`. NEVER commit a real value.
   * When unset, agent reporting is refused (fail closed).
   */
  AGENT_SECRET?: string;
  /**
   * Public base URL of the ASSETS R2 bucket (e.g. https://pub-xxxx.r2.dev
   * or a custom domain). Used to build public character-model URLs.
   */
  R2_PUBLIC_BASE_URL?: string;
  /**
   * Exact origin of the admin UI, e.g. https://virtual-ai-office.pages.dev.
   * When set and the request Origin matches, the Worker answers with
   * credentialed CORS (allow-credentials) so the HttpOnly session cookie
   * is sent cross-site. Set via `wrangler secret put ADMIN_ORIGIN` or [vars].
   */
  ADMIN_ORIGIN?: string;
  /**
   * AI receptionist endpoint (ANOTHER AI, not the poller agent, not
   * Workers AI). OPTIONAL fallback: the admin panel (DO-stored site
   * config) is the PRIMARY way to set the endpoint and wins whenever
   * its URL is non-empty; these env vars apply only when the admin
   * value is empty. When both are unset, the receptionist integration
   * is inert — no call is made and the poller answers guest messages
   * as before. The key ONLY via `npx wrangler secret put
   * RECEPTIONIST_API_KEY`. NEVER commit a value.
   */
  RECEPTIONIST_API_URL?: string;
  RECEPTIONIST_API_KEY?: string;
  /**
   * Wire format of the receptionist endpoint. v1 supports only "openai"
   * (OpenAI-compatible chat completions); any other value makes the
   * adapter inert. Defaults to "openai" when unset.
   */
  RECEPTIONIST_API_FORMAT?: string;
  /**
   * Optional model name sent to OpenAI-compatible endpoints. Omitted from
   * the request body when unset (some endpoints do not need it).
   */
  RECEPTIONIST_MODEL?: string;
}

export interface WorkerConfig {
  demoMode: boolean;
  offlineTimeoutMs: number;
  rateLimitPerMinute: number;
  version: string;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isNaN(n) || n <= 0 ? fallback : n;
}

export function loadWorkerConfig(env: Env): WorkerConfig {
  return {
    demoMode: (env.DEMO_MODE ?? 'true').trim().toLowerCase() === 'true',
    offlineTimeoutMs: parsePositiveInt(env.OFFLINE_TIMEOUT_MS, 30_000),
    rateLimitPerMinute: parsePositiveInt(env.RATE_LIMIT_PER_MINUTE, 60),
    version: '0.1.0',
  };
}
