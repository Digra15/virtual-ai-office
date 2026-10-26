/**
 * AI receptionist adapter (endpoint-agnostic v1).
 *
 * The receptionist is ANOTHER AI reached through an API endpoint the owner
 * supplies later — it is not the poller agent and not Workers AI. This file
 * is the ONLY place that knows the endpoint's wire format, so switching to
 * a custom format later means swapping this adapter, not the DO logic.
 *
 * v1 supports ONE format: an OpenAI-compatible chat-completions endpoint
 * (messages array in, choices[0].message.content out). Any other
 * RECEPTIONIST_API_FORMAT value makes the adapter inert (no call).
 *
 * Safety rules:
 * - If RECEPTIONIST_API_URL is unset (or blank), the integration is inert:
 *   no call is made, no error is raised, behavior stays exactly as today
 *   (the poller answers guest messages as backstop).
 * - The adapter NEVER throws: every failure (timeout, non-2xx, bad
 *   payload) resolves to null, and the caller leaves the guest message
 *   unanswered so the poller can answer it.
 * - Never log the API key or a URL carrying credentials. This module logs
 *   nothing at all; callers log at most a generic status line.
 */
import type { SiteConfig } from '@virtual-ai-office/shared';
import type { Env } from './env';

export interface ReceptionistConfig {
  /** Endpoint URL. Undefined (or blank) = integration inert. */
  url: string | undefined;
  /** Bearer key. Undefined = no Authorization header is sent. */
  apiKey: string | undefined;
  /** Optional model name, sent only when set. */
  model: string | undefined;
  /** Wire format. Only "openai" is supported in v1. */
  format: string;
}

export function getReceptionistConfig(env: Env): ReceptionistConfig {
  const url = env.RECEPTIONIST_API_URL?.trim();
  return {
    url: url ? url : undefined,
    apiKey: env.RECEPTIONIST_API_KEY?.trim() ? env.RECEPTIONIST_API_KEY : undefined,
    model: env.RECEPTIONIST_MODEL?.trim() ? env.RECEPTIONIST_MODEL : undefined,
    format: env.RECEPTIONIST_API_FORMAT?.trim() ? env.RECEPTIONIST_API_FORMAT : 'openai',
  };
}

/**
 * Effective receptionist config: the admin-edited stored siteConfig wins
 * whenever its URL is non-empty (this is the primary way to set the
 * endpoint — the admin panel, no redeploy needed); otherwise the env
 * vars above remain as fallback. The API key ALWAYS comes from the env
 * secret only — stored siteConfig can never supply or override it, and
 * the admin UI never sees it.
 */
export function getReceptionistConfigWithStored(
  env: Env,
  stored: SiteConfig | undefined,
): ReceptionistConfig {
  const base = getReceptionistConfig(env);
  const storedUrl = stored?.receptionistApiUrl?.trim();
  if (!storedUrl) return base;
  const storedFormat = stored?.receptionistApiFormat?.trim();
  const storedModel = stored?.receptionistModel?.trim();
  return {
    ...base,
    url: storedUrl,
    format: storedFormat ? storedFormat : base.format,
    model: storedModel ? storedModel : undefined,
  };
}

/**
 * Difia the receptionist: helpful, honest, Indonesian by default, short
 * chat-style replies. She must never invent facts about the office, its
 * services, or prices; when she does not know, she says so plainly and
 * offers to note the question for the admin.
 */
export const RECEPTIONIST_SYSTEM_PROMPT =
  'Kamu adalah Difia, resepsionis Virtual AI Office — sebuah kantor virtual 3D tempat pengunjung bisa memantau agen-agen AI yang bekerja. ' +
  'Jawablah dengan Bahasa Indonesia yang ramah dan singkat, gaya chat (1–3 kalimat, tanpa format markdown berat). ' +
  'Jangan pernah mengarang fakta tentang kantor ini, layanan, harga, atau orang-orangnya: kalau kamu tidak tahu jawabannya, katakan terus terang bahwa kamu tidak tahu dan tawarkan untuk mencatat pertanyaan pengunjung agar diteruskan ke admin.';

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  text: string;
}

export type FetchImpl = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * Ask the receptionist endpoint for a reply. Returns the reply text, or
 * null when the integration is inert, unsupported, or the call fails in
 * any way. Never throws.
 */
export async function requestReceptionistReply(
  config: ReceptionistConfig,
  history: ChatHistoryItem[],
  newText: string,
  fetchImpl: FetchImpl = fetch as unknown as FetchImpl,
  timeoutMs = 25_000,
): Promise<string | null> {
  if (!config.url || config.format !== 'openai') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const messages = [
      { role: 'system', content: RECEPTIONIST_SYSTEM_PROMPT },
      ...history.map((h) => ({ role: h.role, content: h.text })),
      { role: 'user', content: newText },
    ];
    const body: Record<string, unknown> = { messages };
    if (config.model) body['model'] = config.model;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
    // Race the fetch against a timeout promise so a non-cooperative fetch
    // implementation cannot hang the caller past the deadline.
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });
    const result = await Promise.race([
      fetchImpl(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) return null;
          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: unknown } }>;
          };
          const content = data.choices?.[0]?.message?.content;
          return typeof content === 'string' && content.trim() ? content.trim() : null;
        })
        .catch(() => null),
      timeoutPromise,
    ]);
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
