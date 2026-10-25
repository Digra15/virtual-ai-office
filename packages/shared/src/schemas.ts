/**
 * Zod v4 validation schemas for the Virtual AI Office wire contract.
 *
 * `EventPostSchema` validates the body of `POST /api/agents/:id/events`.
 * Keep these in sync with `types.ts` — the frontend and server both derive
 * their runtime behavior from this module.
 */
import { z } from 'zod';
import { AGENT_STATUSES } from './types';

export const AgentStatusSchema = z.enum(AGENT_STATUSES);

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
