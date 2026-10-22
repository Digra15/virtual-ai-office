/**
 * Worker environment: Durable Object binding + `[vars]` from wrangler.toml.
 * All vars arrive as strings; parsed where used.
 */
export interface Env {
  AGENT_ROOM: DurableObjectNamespace;
  DEMO_MODE?: string;
  OFFLINE_TIMEOUT_MS?: string;
  RATE_LIMIT_PER_MINUTE?: string;
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
