import { describe, expect, it } from "vitest";
import {
  A2AMessageSchema,
  _resetA2ACounterForTests,
  makeA2AMessage,
  MeetingInvitePayloadSchema,
  MeetingMinutesPayloadSchema,
  MeetingTurnPayloadSchema,
} from "./a2a";

describe("A2A message envelope", () => {
  it("builds a valid meeting.invite message", () => {
    _resetA2ACounterForTests();
    const msg = makeA2AMessage("nika", "broadcast", "meeting.invite", {
      meetingId: "m-1",
      topic: "Q4 planning",
      room: "Meeting Room",
    });
    expect(msg.id).toMatch(/^a2a-1-/);
    expect(msg.fromAgentId).toBe("nika");
    expect(msg.type).toBe("meeting.invite");
    expect(() => A2AMessageSchema.parse(msg)).not.toThrow();
    expect(() => MeetingInvitePayloadSchema.parse(msg.payload)).not.toThrow();
  });

  it("rejects an unknown message type", () => {
    expect(() =>
      makeA2AMessage("a", "b", "teleport.now" as never, {}),
    ).toThrow();
  });

  it("rejects empty sender/recipient ids", () => {
    expect(() => makeA2AMessage("", "b", "task.status", {})).toThrow();
    expect(() => makeA2AMessage("a", "", "task.status", {})).toThrow();
  });

  it("validates meeting turn payloads (simulated flag required)", () => {
    const ok = {
      meetingId: "m-1",
      speakerName: "Nika",
      speakerRole: "Personal Assistant",
      text: "Hello",
      simulated: true as const,
    };
    expect(() => MeetingTurnPayloadSchema.parse(ok)).not.toThrow();
    expect(() =>
      MeetingTurnPayloadSchema.parse({ ...ok, simulated: false }),
    ).toThrow();
  });

  it("validates meeting minutes payloads", () => {
    const ok = {
      meetingId: "m-1",
      topic: "Planning",
      decisions: ["Ship it"],
      actionItems: [{ assigneeName: "Nika", text: "Draft plan" }],
      simulated: true as const,
    };
    expect(() => MeetingMinutesPayloadSchema.parse(ok)).not.toThrow();
    expect(() =>
      MeetingMinutesPayloadSchema.parse({ ...ok, actionItems: [{ assigneeName: "", text: "x" }] }),
    ).toThrow();
  });

  it("generates unique ids across messages", () => {
    _resetA2ACounterForTests();
    const a = makeA2AMessage("a", "b", "task.status", {});
    const b = makeA2AMessage("a", "b", "task.status", {});
    expect(a.id).not.toBe(b.id);
  });
});
