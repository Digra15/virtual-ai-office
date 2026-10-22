/**
 * Zod v4 validation schemas for the Virtual AI Office wire contract.
 *
 * `EventPostSchema` validates the body of `POST /api/agents/:id/events`.
 * Keep these in sync with `types.ts` — the frontend and server both derive
 * their runtime behavior from this module.
 */
import { z } from 'zod';
export declare const AgentStatusSchema: z.ZodEnum<{
    error: "error";
    offline: "offline";
    idle: "idle";
    working: "working";
    thinking: "thinking";
    waiting: "waiting";
}>;
export declare const ActivityKindSchema: z.ZodEnum<{
    status: "status";
    note: "note";
    task: "task";
    system: "system";
}>;
export declare const EventPostTypeSchema: z.ZodEnum<{
    status: "status";
    task: "task";
    event: "event";
    heartbeat: "heartbeat";
}>;
export declare const EventPostSchema: z.ZodObject<{
    type: z.ZodEnum<{
        status: "status";
        task: "task";
        event: "event";
        heartbeat: "heartbeat";
    }>;
    status: z.ZodOptional<z.ZodEnum<{
        error: "error";
        offline: "offline";
        idle: "idle";
        working: "working";
        thinking: "thinking";
        waiting: "waiting";
    }>>;
    task: z.ZodOptional<z.ZodString>;
    progress: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    message: z.ZodOptional<z.ZodString>;
    kind: z.ZodOptional<z.ZodEnum<{
        status: "status";
        note: "note";
        task: "task";
        system: "system";
    }>>;
    timestamp: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EventPost = z.infer<typeof EventPostSchema>;
//# sourceMappingURL=schemas.d.ts.map