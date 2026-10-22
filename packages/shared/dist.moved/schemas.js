"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventPostSchema = exports.EventPostTypeSchema = exports.ActivityKindSchema = exports.AgentStatusSchema = void 0;
/**
 * Zod v4 validation schemas for the Virtual AI Office wire contract.
 *
 * `EventPostSchema` validates the body of `POST /api/agents/:id/events`.
 * Keep these in sync with `types.ts` — the frontend and server both derive
 * their runtime behavior from this module.
 */
const zod_1 = require("zod");
const types_1 = require("./types");
exports.AgentStatusSchema = zod_1.z.enum(types_1.AGENT_STATUSES);
exports.ActivityKindSchema = zod_1.z.enum(['status', 'task', 'note', 'system']);
exports.EventPostTypeSchema = zod_1.z.enum(['status', 'task', 'event', 'heartbeat']);
exports.EventPostSchema = zod_1.z
    .object({
    type: exports.EventPostTypeSchema,
    status: exports.AgentStatusSchema.optional(),
    task: zod_1.z.string().min(1).max(500).optional(),
    progress: zod_1.z.number().min(0).max(100).nullable().optional(),
    message: zod_1.z.string().min(1).max(2000).optional(),
    kind: exports.ActivityKindSchema.optional(),
    timestamp: zod_1.z.string().datetime().optional(),
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
//# sourceMappingURL=schemas.js.map