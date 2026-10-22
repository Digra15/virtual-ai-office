/**
 * Server configuration: typed env parsing with sane defaults.
 *
 * `loadConfig` is pure (takes an env-like record) so it is trivially
 * unit-testable. `createApp` overlays `AppOverrides` on top of it.
 */

export interface ServerConfig {
  /** TCP port the HTTP + WebSocket server listens on. */
  port: number;
  /** Origins allowed to call the REST API / open the WebSocket. */
  corsOrigins: string[];
  /** When true, the DemoAdapter simulates 8 clearly-labeled demo agents. */
  demoMode: boolean;
  /** Live agents with no event/heartbeat within this window are marked offline. */
  offlineTimeoutMs: number;
  /** Max `POST /api/agents/:id/events` requests per IP per minute. */
  rateLimitPerMinute: number;
  /** Server version reported by `/health`. Keep in sync with package.json. */
  version: string;
}

type EnvLike = Record<string, string | undefined>;

function parsePort(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isNaN(n) || n <= 0 || n > 65535 ? 4000 : n;
}

function parseOrigins(raw: string | undefined): string[] {
  const list = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length > 0 ? list : ['http://localhost:5173'];
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  return raw.trim().toLowerCase() === 'true';
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isNaN(n) || n <= 0 ? fallback : n;
}

export function loadConfig(env: EnvLike = process.env): ServerConfig {
  return {
    port: parsePort(env.PORT),
    corsOrigins: parseOrigins(env.CORS_ORIGIN),
    demoMode: parseBool(env.DEMO_MODE, true),
    offlineTimeoutMs: parsePositiveInt(env.OFFLINE_TIMEOUT_MS, 30_000),
    rateLimitPerMinute: parsePositiveInt(env.RATE_LIMIT_PER_MINUTE, 60),
    version: '0.1.0',
  };
}
