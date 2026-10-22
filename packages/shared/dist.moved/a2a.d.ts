import { z } from "zod";
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
export declare const A2AMessageTypeSchema: z.ZodEnum<{
    "meeting.invite": "meeting.invite";
    "meeting.accept": "meeting.accept";
    "meeting.decline": "meeting.decline";
    "meeting.turn": "meeting.turn";
    "meeting.minutes": "meeting.minutes";
    "task.assign": "task.assign";
    "task.status": "task.status";
}>;
export type A2AMessageType = z.infer<typeof A2AMessageTypeSchema>;
/**
 * The A2A envelope. `toAgentId` may be a concrete agent id or the literal
 * "broadcast" for room-wide messages. `payload` is type-specific and kept
 * deliberately loose (validated per-type by consumers).
 */
export declare const A2AMessageSchema: z.ZodObject<{
    id: z.ZodString;
    fromAgentId: z.ZodString;
    toAgentId: z.ZodString;
    type: z.ZodEnum<{
        "meeting.invite": "meeting.invite";
        "meeting.accept": "meeting.accept";
        "meeting.decline": "meeting.decline";
        "meeting.turn": "meeting.turn";
        "meeting.minutes": "meeting.minutes";
        "task.assign": "task.assign";
        "task.status": "task.status";
    }>;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    timestamp: z.ZodString;
}, z.core.$strip>;
export type A2AMessage = z.infer<typeof A2AMessageSchema>;
/** Payload for `meeting.invite`. */
export declare const MeetingInvitePayloadSchema: z.ZodObject<{
    meetingId: z.ZodString;
    topic: z.ZodString;
    room: z.ZodString;
}, z.core.$strip>;
export type MeetingInvitePayload = z.infer<typeof MeetingInvitePayloadSchema>;
/** Payload for `meeting.turn` — one simulated dialogue turn. */
export declare const MeetingTurnPayloadSchema: z.ZodObject<{
    meetingId: z.ZodString;
    speakerName: z.ZodString;
    speakerRole: z.ZodString;
    text: z.ZodString;
    simulated: z.ZodLiteral<true>;
}, z.core.$strip>;
export type MeetingTurnPayload = z.infer<typeof MeetingTurnPayloadSchema>;
/** Payload for `meeting.minutes` — auto-generated meeting notes. */
export declare const MeetingMinutesPayloadSchema: z.ZodObject<{
    meetingId: z.ZodString;
    topic: z.ZodString;
    decisions: z.ZodArray<z.ZodString>;
    actionItems: z.ZodArray<z.ZodObject<{
        assigneeName: z.ZodString;
        text: z.ZodString;
    }, z.core.$strip>>;
    simulated: z.ZodLiteral<true>;
}, z.core.$strip>;
export type MeetingMinutesPayload = z.infer<typeof MeetingMinutesPayloadSchema>;
/** Payload for `task.assign`. */
export declare const TaskAssignPayloadSchema: z.ZodObject<{
    taskId: z.ZodString;
    title: z.ZodString;
    brief: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TaskAssignPayload = z.infer<typeof TaskAssignPayloadSchema>;
/** Payload for `task.status`. */
export declare const TaskStatusPayloadSchema: z.ZodObject<{
    taskId: z.ZodString;
    status: z.ZodEnum<{
        todo: "todo";
        in_progress: "in_progress";
        review: "review";
        done: "done";
    }>;
    progress: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type TaskStatusPayload = z.infer<typeof TaskStatusPayloadSchema>;
/**
 * Build a validated A2A message. Throws if the envelope is invalid — callers
 * should let this throw rather than send malformed protocol messages.
 */
export declare function makeA2AMessage(fromAgentId: string, toAgentId: string, type: A2AMessageType, payload: Record<string, unknown>): A2AMessage;
/** Reset the message counter (tests only). */
export declare function _resetA2ACounterForTests(): void;
//# sourceMappingURL=a2a.d.ts.map