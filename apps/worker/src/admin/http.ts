/**
 * Tiny HTTP helpers for the admin/public API: JSON responses, {error} bodies,
 * and safe JSON-body parsing.
 */

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export function json(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

/** Standard error body: {error: string} (+ details for 400s). */
export function err(status: number, message: string, details?: unknown): Response {
  const body: Record<string, unknown> = { error: message };
  if (details !== undefined) body.details = details;
  return json(body, status);
}

export type JsonRead =
  | { ok: true; value: unknown }
  | { ok: false };

/** Read a JSON body; ok:false when the body is missing or not valid JSON. */
export async function readJson(request: Request): Promise<JsonRead> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}
