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
export const A2AMessageTypeSchema = z.enum([
  "meeting.invite",
  "meeting.accept",
  "meeting.decline",
  "meeting.turn",
  "meeting.minutes",
  "task.assign",
  "task.status",
]);

export type A2AMessageType = z.infer<typeof A2AMessageTypeSchema>;

/**
 * The A2A envelope. `toAgentId` may be a concrete agent id or the literal
 * "broadcast" for room-wide messages. `payload` is type-specific and kept
 * deliberately loose (validated per-type by consumers).
 */
export const A2AMessageSchema = z.object({
  /** Unique message id (uuid or `a2a-<counter>-<ts>`). */
  id: z.string().min(1),
  /** Sender agent id. */
  fromAgentId: z.string().min(1),
  /** Recipient agent id, or "broadcast". */
  toAgentId: z.string().min(1),
  /** Message kind. */
  type: A2AMessageTypeSchema,
  /** Type-specific content. */
  payload: z.record(z.string(), z.unknown()),
  /** ISO-8601 timestamp. */
  timestamp: z.string().datetime({ offset: true }),
});

export type A2AMessage = z.infer<typeof A2AMessageSchema>;

/** Payload for `meeting.invite`. */
export const MeetingInvitePayloadSchema = z.object({
  meetingId: z.string().min(1),
  topic: z.string().min(1),
  room: z.string().min(1),
});

export type MeetingInvitePayload = z.infer<typeof MeetingInvitePayloadSchema>;

/** Payload for `meeting.turn` — one simulated dialogue turn. */
export const MeetingTurnPayloadSchema = z.object({
  meetingId: z.string().min(1),
  speakerName: z.string().min(1),
  speakerRole: z.string().min(1),
  text: z.string().min(1),
  /** Always true for now — the transport is simulated. */
  simulated: z.literal(true),
});

export type MeetingTurnPayload = z.infer<typeof MeetingTurnPayloadSchema>;

/** Payload for `meeting.minutes` — auto-generated meeting notes. */
export const MeetingMinutesPayloadSchema = z.object({
  meetingId: z.string().min(1),
  topic: z.string().min(1),
  decisions: z.array(z.string()),
  actionItems: z.array(
    z.object({
      assigneeName: z.string().min(1),
      text: z.string().min(1),
    }),
  ),
  simulated: z.literal(true),
});

export type MeetingMinutesPayload = z.infer<typeof MeetingMinutesPayloadSchema>;

/** Payload for `task.assign`. */
export const TaskAssignPayloadSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().min(1),
  brief: z.string().optional(),
});

export type TaskAssignPayload = z.infer<typeof TaskAssignPayloadSchema>;

/** Payload for `task.status`. */
export const TaskStatusPayloadSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(["todo", "in_progress", "review", "done"]),
  progress: z.number().min(0).max(100).optional(),
});

export type TaskStatusPayload = z.infer<typeof TaskStatusPayloadSchema>;

let a2aCounter = 0;

/**
 * Build a validated A2A message. Throws if the envelope is invalid — callers
 * should let this throw rather than send malformed protocol messages.
 */
export function makeA2AMessage(
  fromAgentId: string,
  toAgentId: string,
  type: A2AMessageType,
  payload: Record<string, unknown>,
): A2AMessage {
  a2aCounter += 1;
  return A2AMessageSchema.parse({
    id: `a2a-${a2aCounter}-${Date.now()}`,
    fromAgentId,
    toAgentId,
    type,
    payload,
    timestamp: new Date().toISOString(),
  });
}

/** Reset the message counter (tests only). */
export function _resetA2ACounterForTests(): void {
  a2aCounter = 0;
}
