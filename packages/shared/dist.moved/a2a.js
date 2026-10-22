"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskStatusPayloadSchema = exports.TaskAssignPayloadSchema = exports.MeetingMinutesPayloadSchema = exports.MeetingTurnPayloadSchema = exports.MeetingInvitePayloadSchema = exports.A2AMessageSchema = exports.A2AMessageTypeSchema = void 0;
exports.makeA2AMessage = makeA2AMessage;
exports._resetA2ACounterForTests = _resetA2ACounterForTests;
const zod_1 = require("zod");
/**
 * A2A (agent-to-agent) message envelope for the Virtual AI Office.
 *
 * This is the PROTOCOL CONTRACT for inter-agent communication — inspired by
 * the Hermes Virtual Office's A2A meetings. Every agent message, whether it
 * carries a meeting invite, a dialogue turn, or a task assignment, uses this
 * envelope.
 *
 * HONEST TRANSPORT NOTE: the envelope is real and validated, but the current
 * transport is SIMULATED IN-CLIENT (the web app generates template-based
 * turns locally). No real LLM agents are behind these messages until a real
 * agent connector is wired to the backend. All UI surfaces that display A2A
 * content must label it "simulated".
 */
/** Kinds of A2A messages the office understands. */
exports.A2AMessageTypeSchema = zod_1.z.enum([
    "meeting.invite",
    "meeting.accept",
    "meeting.decline",
    "meeting.turn",
    "meeting.minutes",
    "task.assign",
    "task.status",
]);
/**
 * The A2A envelope. `toAgentId` may be a concrete agent id or the literal
 * "broadcast" for room-wide messages. `payload` is type-specific and kept
 * deliberately loose (validated per-type by consumers).
 */
exports.A2AMessageSchema = zod_1.z.object({
    /** Unique message id (uuid or `a2a-<counter>-<ts>`). */
    id: zod_1.z.string().min(1),
    /** Sender agent id. */
    fromAgentId: zod_1.z.string().min(1),
    /** Recipient agent id, or "broadcast". */
    toAgentId: zod_1.z.string().min(1),
    /** Message kind. */
    type: exports.A2AMessageTypeSchema,
    /** Type-specific content. */
    payload: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    /** ISO-8601 timestamp. */
    timestamp: zod_1.z.string().datetime({ offset: true }),
});
/** Payload for `meeting.invite`. */
exports.MeetingInvitePayloadSchema = zod_1.z.object({
    meetingId: zod_1.z.string().min(1),
    topic: zod_1.z.string().min(1),
    room: zod_1.z.string().min(1),
});
/** Payload for `meeting.turn` — one simulated dialogue turn. */
exports.MeetingTurnPayloadSchema = zod_1.z.object({
    meetingId: zod_1.z.string().min(1),
    speakerName: zod_1.z.string().min(1),
    speakerRole: zod_1.z.string().min(1),
    text: zod_1.z.string().min(1),
    /** Always true for now — the transport is simulated. */
    simulated: zod_1.z.literal(true),
});
/** Payload for `meeting.minutes` — auto-generated meeting notes. */
exports.MeetingMinutesPayloadSchema = zod_1.z.object({
    meetingId: zod_1.z.string().min(1),
    topic: zod_1.z.string().min(1),
    decisions: zod_1.z.array(zod_1.z.string()),
    actionItems: zod_1.z.array(zod_1.z.object({
        assigneeName: zod_1.z.string().min(1),
        text: zod_1.z.string().min(1),
    })),
    simulated: zod_1.z.literal(true),
});
/** Payload for `task.assign`. */
exports.TaskAssignPayloadSchema = zod_1.z.object({
    taskId: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1),
    brief: zod_1.z.string().optional(),
});
/** Payload for `task.status`. */
exports.TaskStatusPayloadSchema = zod_1.z.object({
    taskId: zod_1.z.string().min(1),
    status: zod_1.z.enum(["todo", "in_progress", "review", "done"]),
    progress: zod_1.z.number().min(0).max(100).optional(),
});
let a2aCounter = 0;
/**
 * Build a validated A2A message. Throws if the envelope is invalid — callers
 * should let this throw rather than send malformed protocol messages.
 */
function makeA2AMessage(fromAgentId, toAgentId, type, payload) {
    a2aCounter += 1;
    return exports.A2AMessageSchema.parse({
        id: `a2a-${a2aCounter}-${Date.now()}`,
        fromAgentId,
        toAgentId,
        type,
        payload,
        timestamp: new Date().toISOString(),
    });
}
/** Reset the message counter (tests only). */
function _resetA2ACounterForTests() {
    a2aCounter = 0;
}
//# sourceMappingURL=a2a.js.map