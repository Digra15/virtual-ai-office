import { timingSafeEqual } from './admin/auth';

/**
 * Shared agent-reporting auth check for the REST event/task routes and
 * the WebSocket heartbeat path, extracted from room.ts so it is
 * unit-testable without the Durable Object runtime.
 *
 * Returns null when authorized, otherwise the HTTP status the caller
 * should answer with: 503 when the secret is unset (fail closed),
 * 403 on a missing, malformed, or mismatched token. The secret itself
 * is never logged or returned.
 */
export function agentAuthError(
  secret: string | undefined,
  authorization: string | null,
): 503 | 403 | null {
  if (!secret) return 503;
  if (
    !authorization ||
    !authorization.startsWith('Bearer ') ||
    !timingSafeEqual(authorization.slice('Bearer '.length), secret)
  ) {
    return 403;
  }
  return null;
}
