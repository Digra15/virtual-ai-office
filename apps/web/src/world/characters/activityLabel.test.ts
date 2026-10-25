import { describe, expect, it } from "vitest";
import { activityLabel } from "./activityLabel";

describe("activityLabel", () => {
  it("maps each status to its caption", () => {
    expect(activityLabel({ status: "working" }).text).toBe("working");
    expect(activityLabel({ status: "thinking" }).text).toBe("thinking");
    expect(activityLabel({ status: "waiting" }).text).toBe("waiting");
    expect(activityLabel({ status: "meeting" }).text).toBe("meeting");
    expect(activityLabel({ status: "error" }).text).toBe("error");
    expect(activityLabel({ status: "offline" }).text).toBe("offline");
    expect(activityLabel({ status: "idle" }).text).toBe("idle");
    expect(activityLabel({ status: "something-new" }).text).toBe("idle");
  });

  it("shows eating on pantry break and walking while moving", () => {
    expect(activityLabel({ status: "idle", activity: "break" }).text).toBe("eating");
    expect(activityLabel({ status: "working", activity: "walking" }).text).toBe("walking");
    expect(activityLabel({ status: "idle", activity: "meeting" }).text).toBe("meeting");
  });

  it("shows praying whenever a prayer pose is active", () => {
    expect(
      activityLabel({ status: "working", activity: "seated", prayerPose: "bowing" }).text,
    ).toBe("praying");
  });

  it("keeps zZ for a lying (sleeping) agent whatever its status", () => {
    expect(activityLabel({ status: "working", lying: true }).text).toBe("zZ");
    expect(activityLabel({ status: "recovering", lying: true }).text).toBe("zZ");
  });
});
