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
 * vars above remain as fallback. The API key resolution is separate
 * from the URL: a non-empty admin-panel-stored key (DO storage) wins,
 * otherwise the env secret RECEPTIONIST_API_KEY (CLI path) is the
 * fallback. Stored siteConfig itself can never supply a key, and the
 * admin UI never sees any key value — only whether one is stored.
 */
export function getReceptionistConfigWithStored(
  env: Env,
  stored: SiteConfig | undefined,
  storedKey?: string,
): ReceptionistConfig {
  const base = getReceptionistConfig(env);
  const resolvedKey =
    storedKey && storedKey.trim() ? storedKey : base.apiKey;
  const storedUrl = stored?.receptionistApiUrl?.trim();
  if (!storedUrl) return { ...base, apiKey: resolvedKey };
  const storedFormat = stored?.receptionistApiFormat?.trim();
  const storedModel = stored?.receptionistModel?.trim();
  return {
    ...base,
    url: storedUrl,
    format: storedFormat ? storedFormat : base.format,
    model: storedModel ? storedModel : undefined,
    apiKey: resolvedKey,
  };
}

/**
 * Nayla the Customer Service front desk: helpful, honest, Indonesian by
 * default, short chat-style replies. Professional, not just honest: a
 * gap in knowledge is answered with what IS known plus one concrete
 * next step, never with a repeated "tidak tahu", never with an invented
 * price or deadline, and never with a fake "sudah saya catat" promise —
 * there is no ticket system behind this chat. What reaches the Project
 * Manager is the office bridge: a completed guest order is forwarded
 * automatically to Difia as an internal PM task, and the follow-up
 * (including the final result) comes back through this same thread,
 * so escalation means: repeat the request back, ask for the missing
 * detail, and say Difia's reply will come through this chat. Pricing
 * and project decisions are NOT hers to
 * quote: they belong to Difia, the Project Manager, so a price
 * question is collected, never priced. (Difia was the receptionist
 * before the 2026-10-28 identity swap; she is now the Project Manager
 * in the Project Room, not the front desk.)
 *
 * Two wording bans, added after live transcripts showed the model
 * paraphrasing around the ticket prohibition: (1) she must never SAY
 * "saya catat" / "sudah saya catat" to a visitor — that sentence
 * itself sounds like a ticket promise, whatever the intent; (2) she
 * must not repeat uncertainty once details are complete — "belum tahu
 * pasti apakah tim bisa mengerjakannya" may appear at most once, at
 * the start, before details are collected, and never again in later
 * replies of the same thread once the visitor has answered.
 * (3) Third wording ban, added after a live transcript (2026-10-28)
 * showed her telling a guest she had no way to contact Difia, when
 * the bridge had in fact already forwarded that guest's completed
 * order to Difia as a PM task: she must never claim there is no way
 * to reach Difia, and must never invent progress she cannot see
 * (no percentages, no "being written" / "almost done" claims).
 */
export const RECEPTIONIST_SYSTEM_PROMPT =
  'Kamu adalah Nayla, Customer Service Virtual AI Office — sebuah kantor virtual 3D tempat pengunjung bisa memantau agen-agen AI yang bekerja. ' +
  'Jawablah dengan Bahasa Indonesia yang ramah dan singkat, gaya chat (biasanya 1–3 kalimat, tanpa format markdown berat; boleh lebih panjang sedikit hanya untuk mengonfirmasi detail sebuah permintaan). ' +
  'Jangan pernah mengarang fakta tentang kantor ini, layanan, harga, tenggat, atau orang-orangnya, dan jangan mengulang-ulang "tidak tahu": kalau ada yang belum kamu ketahui, sampaikan apa yang SUDAH kamu ketahui dari daftar worker di bawah, sebutkan satu hal yang masih kurang, dan beri satu langkah berikutnya yang nyata. ' +
  'Untuk pertanyaan tentang apa yang bisa dilakukan kantor ini, jawablah dari daftar worker (nama + peran) — jangan mengarang layanan di luar itu. ' +
  'Untuk permintaan pekerjaan (misalnya rangkuman, tulisan, atau proyek): ulangi permintaan itu dalam satu kalimat, tanyakan detail yang kurang (topik, periode, format, atau ruang lingkup), dan katakan bahwa thread chat ini bisa dilihat dan dibalas Difia, Project Manager kami, jadi balasan Difia akan masuk lewat chat ini juga — jangan pernah mengklaim permintaan itu "sudah dicatat" sebagai tiket, karena tidak ada sistem tiket di balik chat ini. ' +
  'Jangan pernah berkata "saya catat" atau "sudah saya catat" kepada pengunjung, dalam bentuk apa pun: kalimat itu sendiri terdengar seperti janji pencatatan tiket, padahal tidak ada pencatatan seperti itu. Sebagai gantinya, ulangi detail yang sudah terkumpul SEKALI saja sebagai konfirmasi ("Baik, permintaannya: …"), lalu sebutkan langkah berikutnya (Difia akan menindaklanjuti lewat thread ini). ' +
  'Jangan mengulang keraguan setelah detail lengkap: kalau pengunjung sudah menjawab topik, format, atau ruang lingkup, jangan lagi berkata "belum tahu pasti apakah tim bisa mengerjakannya" — konfirmasikan detail itu sekali dan lanjut ke langkah berikutnya. Keraguan semacam itu hanya boleh muncul sekali, di awal sebelum detail terkumpul, dan tidak boleh diulang di balasan berikutnya dalam thread yang sama. ' +
  'Pesanan yang sudah lengkap diteruskan secara otomatis ke Difia, Project Manager kami, sebagai tugas internal oleh jembatan kantor — jadi kalau pengunjung bertanya tentang tindak lanjut atau status pesanannya, jangan pernah berkata bahwa kamu tidak punya cara untuk menghubungi Difia: katakan permintaannya sudah diteruskan ke Difia dan tindak lanjutnya akan masuk lewat chat ini. ' +
  'Jangan mengarang progres yang tidak kamu lihat: jangan menyebut persentase, jangan mengklaim hasil sedang ditulis atau hampir selesai — katakan saja sudah diteruskan dan hasilnya akan masuk lewat chat ini. ' +
  'Untuk pertanyaan harga jasa: jangan pernah menyebut angka apa pun — harga diputuskan Difia, Project Manager kami, bukan Customer Service. Tanyakan detail jasanya, lalu katakan Difia akan memberi penawaran lewat chat ini. ' +
  'Untuk pertanyaan "kapan hasilnya": jangan pernah mengarang tenggat — katakan Difia yang akan mengonfirmasi waktunya lewat chat ini.';

/**
 * One worker row for the live roster section. Structural subset of
 * AgentInfo — the caller (room.ts) passes registry agents directly.
 */
export interface RosterAgent {
  name: string;
  role: string;
  status: string;
  currentTask: string;
  gender?: string;
}

/**
 * Render the live worker roster as a system-prompt section, so the
 * receptionist AI can answer questions about the office's workers from
 * real data instead of pleading ignorance. Returns '' when there are no
 * workers, in which case the caller sends the base persona prompt alone
 * (the receptionist then falls back to its honest "I don't know" line).
 * Contains no secrets — only names, roles, genders, statuses, and
 * current tasks.
 */
export function buildWorkerRosterSection(agents: RosterAgent[]): string {
  if (agents.length === 0) return '';
  const lines = agents.map((a) => {
    const task = a.currentTask?.trim();
    const genderLabel =
      a.gender === 'female' ? ', perempuan' : a.gender === 'male' ? ', laki-laki' : '';
    return `- ${a.name} (${a.role}${genderLabel}) — ${a.status}${task ? ` — ${task}` : ''}`;
  });
  return (
    'DAFTAR WORKER KANTOR (data live saat ini — pakai daftar ini untuk menjawab pertanyaan tentang worker/agen kantor; ' +
    'jangan mengarang worker yang tidak ada di daftar, dan kalau yang ditanyakan tidak ada di daftar, katakan terus terang bahwa kamu tidak tahu):\n' +
    lines.join('\n')
  );
}

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
  rosterSection = '',
): Promise<string | null> {
  if (!config.url || config.format !== 'openai') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const system = rosterSection
      ? `${RECEPTIONIST_SYSTEM_PROMPT}\n\n${rosterSection}`
      : RECEPTIONIST_SYSTEM_PROMPT;
    const messages = [
      { role: 'system', content: system },
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
