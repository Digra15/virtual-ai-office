/**
 * Zod v4 validation schemas for the Virtual AI Office wire contract.
 *
 * `EventPostSchema` validates the body of `POST /api/agents/:id/events`.
 * Keep these in sync with `types.ts` — the frontend and server both derive
 * their runtime behavior from this module.
 */
import { z } from 'zod';
import { AGENT_GENDERS, AGENT_STATUSES } from './types';

export const AgentStatusSchema = z.enum(AGENT_STATUSES);

export const AgentGenderSchema = z.enum(AGENT_GENDERS);

export const ActivityKindSchema = z.enum(['status', 'task', 'note', 'system']);

export const EventPostTypeSchema = z.enum(['status', 'task', 'event', 'heartbeat']);

export const EventPostSchema = z
  .object({
    type: EventPostTypeSchema,
    status: AgentStatusSchema.optional(),
    task: z.string().min(1).max(500).optional(),
    progress: z.number().min(0).max(100).nullable().optional(),
    message: z.string().min(1).max(2000).optional(),
    kind: ActivityKindSchema.optional(),
    timestamp: z.string().datetime().optional(),
    // Identity fields for (first) reports: a reporting agent may declare
    // its name, role, and workstation. The registry applies them on seat
    // creation and on later reports (identity updates). Absent = keep the
    // existing identity (or the seed/default for a brand-new seat).
    name: z.string().min(1).max(80).optional(),
    role: z.string().min(1).max(80).optional(),
    workstationId: z.string().min(1).max(50).optional(),
    // Explicit gender (male/female). The registry applies it like the
    // other identity fields; absent = keep the existing gender (or
    // unknown for a brand-new seat). Never inferred from the id.
    gender: AgentGenderSchema.optional(),
  })
  .superRefine((value, ctx) => {
    // Per-type required fields (monitoring only — no remote commands here).
    if (value.type === 'status' && value.status === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: "Event type 'status' requires a 'status' field",
        path: ['status'],
      });
    }
    if (value.type === 'task' && value.task === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: "Event type 'task' requires a 'task' field",
        path: ['task'],
      });
    }
    if (value.type === 'event' && value.message === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: "Event type 'event' requires a 'message' field",
        path: ['message'],
      });
    }
    // 'heartbeat' needs nothing.
  });

export type EventPost = z.infer<typeof EventPostSchema>;

/**
 * Task queue (office → agent). The office assigns a task to a live agent
 * via `POST /api/agents/:id/tasks`; the agent's poller lists pending tasks
 * and marks them done. Tasks are commands, not execution: the registry
 * never runs them.
 */
export const TaskStatusSchema = z.enum(['pending', 'done']);

export const TaskPostSchema = z.object({
  title: z.string().min(1).max(500),
  detail: z.string().max(2000).optional(),
});

export type TaskPost = z.infer<typeof TaskPostSchema>;

export interface AgentTask {
  id: string;
  agentId: string;
  title: string;
  detail?: string;
  status: 'pending' | 'done';
  createdAt: string;
  completedAt: string | null;
}

/**
 * Runtime site settings (office → admin). Stored in the Durable Object,
 * NOT in D1, so they work without the admin backend: GET /api/config is
 * public, POST /api/config requires the agent bearer secret (interim auth
 * until the full admin session auth lands). The offline timeout here
 * replaces the OFFLINE_TIMEOUT_MS env var once a value has been saved;
 * the env var remains the initial default for a fresh deployment.
 *
 * The three receptionist* fields are NON-SECRET endpoint settings for the
 * AI receptionist (another AI via an owner-supplied endpoint): they are
 * edited in the admin panel and returned by the public GET /api/config,
 * so they must NEVER carry a credential. The API key, when the endpoint
 * needs one, lives ONLY in the Worker secret RECEPTIONIST_API_KEY and is
 * never part of this schema, never shown in the admin UI, never stored
 * here. An empty URL means the endpoint integration is inert and the
 * poller answers guest messages as before.
 */
export const SiteConfigSchema = z.object({
  officeName: z.string().min(1).max(80),
  announcement: z.string().max(500),
  offlineTimeoutMs: z.number().int().min(30_000).max(3_600_000),
  receptionistApiUrl: z
    .string()
    .max(500)
    .refine(
      (v) => {
        if (v === '') return true;
        try {
          const u = new URL(v);
          return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'receptionistApiUrl must be empty or a valid http(s) URL' },
    )
    .default(''),
  receptionistApiFormat: z.string().max(50).default('openai'),
  receptionistModel: z.string().max(100).default(''),
});

export type SiteConfig = z.infer<typeof SiteConfigSchema>;

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  officeName: 'Virtual AI Office',
  announcement: '',
  offlineTimeoutMs: 600_000,
  receptionistApiUrl: '',
  receptionistApiFormat: 'openai',
  receptionistModel: '',
};

/**
 * Guest chat (visitor → Nayla, Customer Service). Visitors chat with
 * Nayla the front desk (played by the main assistant, answering via the
 * poller — replies arrive within minutes, not seconds). Threads live in
 * the Durable Object, NOT in D1, so no migration is needed.
 * `at`/`updatedAt` are server ms timestamps. The legacy 'difia' value
 * stays in the enum so threads written before the 2026-10-28 identity
 * swap (when Difia was the receptionist) still validate on read; new
 * replies use 'nayla' only.
 */
export const GuestChatMessageSchema = z.object({
  id: z.string(),
  guestId: z.string(),
  guestName: z.string(),
  from: z.enum(['guest', 'difia', 'nayla', 'admin']),
  text: z.string().min(1).max(1000),
  at: z.number().int(),
});

export type GuestChatMessage = z.infer<typeof GuestChatMessageSchema>;

export const GuestThreadSchema = z.object({
  guestId: z.string(),
  guestName: z.string(),
  messages: z.array(GuestChatMessageSchema),
  updatedAt: z.number().int(),
});

export type GuestThread = z.infer<typeof GuestThreadSchema>;

/** POST /api/guest-chat body (public). guestId is client-generated. */
export const GuestChatPostSchema = z.object({
  guestId: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'guestId must be URL-safe (letters, digits, - _)'),
  guestName: z.string().max(40).optional(),
  text: z.string().min(1).max(1000),
});

export type GuestChatPost = z.infer<typeof GuestChatPostSchema>;

/** Reply body (agent bearer auth, or admin session auth). */
export const GuestReplySchema = z.object({
  text: z.string().min(1).max(1000),
});

export type GuestReply = z.infer<typeof GuestReplySchema>;

/**
 * Follow-up body (agent bearer auth only). Deliberately roomier than
 * GuestReplySchema: a follow-up carries corrections and final deliveries
 * (e.g. a news summary), which legitimately run longer than a chat reply.
 */
export const GuestFollowupSchema = z.object({
  text: z.string().min(1).max(2000),
});

export type GuestFollowup = z.infer<typeof GuestFollowupSchema>;
