/**
 * Resolves backend connection settings.
 *
 * - In dev (`DEV`), missing vars fall back to a local backend.
 * - In production, the project's live Worker is the default: env vars win
 *   when set, otherwise the baked-in live URLs are used. Missing vars no
 *   longer mean "backend not configured" — that state previously trapped
 *   the public deployment in local demo data whenever the dashboard env
 *   was forgotten (2026-10-26). A per-browser override in Settings still
 *   wins over both (see useSettingsStore).
 * Localhost is NEVER used outside of dev.
 */
export interface BackendEnv {
  configured: boolean;
  /** Base URL of the REST API (no trailing slash). Empty when not configured. */
  apiUrl: string;
  /** WebSocket URL (ends in /ws). Empty when not configured. */
  wsUrl: string;
}

/** This project's live Worker — the production default backend. */
export const DEFAULT_API_URL =
  "https://virtual-ai-office-api.dalikamira.workers.dev";
export const DEFAULT_WS_URL =
  "wss://virtual-ai-office-api.dalikamira.workers.dev/ws";

export function resolveBackendEnv(env: {
  DEV: boolean;
  VITE_API_URL?: string;
  VITE_WS_URL?: string;
}): BackendEnv {
  if (env.DEV) {
    return {
      configured: true,
      apiUrl: env.VITE_API_URL || "http://localhost:4000",
      wsUrl: env.VITE_WS_URL || "ws://localhost:4000/ws",
    };
  }

  return {
    configured: true,
    apiUrl: env.VITE_API_URL || DEFAULT_API_URL,
    wsUrl: env.VITE_WS_URL || DEFAULT_WS_URL,
  };
}

export const backendEnv: BackendEnv = resolveBackendEnv(import.meta.env);
