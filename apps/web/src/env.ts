/**
 * Resolves backend connection settings from Vite env vars.
 *
 * - In dev (`import.meta.env.DEV`), missing vars fall back to a local backend.
 * - In production, missing vars mean `configured: false` — the UI must show a
 *   "backend not configured" error state instead of silently using localhost.
 * Localhost is NEVER used outside of dev.
 */
export interface BackendEnv {
  configured: boolean;
  /** Base URL of the REST API (no trailing slash). Empty when not configured. */
  apiUrl: string;
  /** WebSocket URL (ends in /ws). Empty when not configured. */
  wsUrl: string;
}

function resolveBackendEnv(): BackendEnv {
  const dev = import.meta.env.DEV;
  const api = import.meta.env.VITE_API_URL as string | undefined;
  const ws = import.meta.env.VITE_WS_URL as string | undefined;

  if (dev) {
    return {
      configured: true,
      apiUrl: api || "http://localhost:4000",
      wsUrl: ws || "ws://localhost:4000/ws",
    };
  }

  const configured = Boolean(api && ws);
  return { configured, apiUrl: api ?? "", wsUrl: ws ?? "" };
}

export const backendEnv: BackendEnv = resolveBackendEnv();
