import { describe, expect, it, afterEach } from "vitest";
import {
  MUSOLA_ROOM_ID,
  agentRoomId,
  deskFacing,
  isInMusola,
  roomIdAtPosition,
} from "./facing";
import { movement } from "../movement";
import { FLOOR_HEIGHT, ROOM_BY_ID } from "../building/floorPlan";

const MUSOLA = ROOM_BY_ID["musola"];
const MUSOLA_CX = (MUSOLA.minX + MUSOLA.maxX) / 2;
const MUSOLA_CZ = (MUSOLA.minZ + MUSOLA.maxZ) / 2;

describe("MUSOLA_ROOM_ID contract", () => {
  it("matches the building's musola room id", () => {
    expect(MUSOLA_ROOM_ID).toBe("musola");
    expect(ROOM_BY_ID[MUSOLA_ROOM_ID]).toBeDefined();
  });
});

describe("deskFacing", () => {
  it("points a seated agent at the monitor (desk rotation + PI)", () => {
    // ws-01..04 face desk rotation 0 → nose toward −z (monitor side).
    expect(deskFacing("ws-01")).toBeCloseTo(Math.PI, 10);
    // ws-05..08 face desk rotation PI → nose toward +z.
    expect(deskFacing("ws-05")).toBeCloseTo(0, 10);
  });

  it("covers the new floorPlan workstations", () => {
    // konten-01 rotationY = PI → nose +z (0).
    expect(deskFacing("konten-01")).toBeCloseTo(0, 10);
    // focus-01 rotationY = PI/2 → nose wraps to −PI/2.
    expect(deskFacing("focus-01")).toBeCloseTo(-Math.PI / 2, 10);
  });

  it("falls back to PI (face the room) for unknown ids", () => {
    expect(deskFacing("nope-99")).toBeCloseTo(Math.PI, 10);
  });
});

describe("roomIdAtPosition", () => {
  it("resolves the musola center on the upper floor", () => {
    expect(roomIdAtPosition(MUSOLA_CX, FLOOR_HEIGHT, MUSOLA_CZ)).toBe("musola");
  });

  it("does not report musola at ground level under it", () => {
    expect(roomIdAtPosition(MUSOLA_CX, 0, MUSOLA_CZ)).not.toBe("musola");
  });

  it("returns null outside every room", () => {
    expect(roomIdAtPosition(999, 0, 999)).toBeNull();
  });
});

describe("prayer trigger (isInMusola / agentRoomId)", () => {
  const AGENT = "facing-test-agent";

  afterEach(() => {
    movement.unregister(AGENT);
  });

  it("is false for unregistered agents", () => {
    expect(agentRoomId(AGENT)).toBeNull();
    expect(isInMusola(AGENT)).toBe(false);
  });

  it("becomes true when the agent arrives inside the musola", () => {
    movement.register(AGENT, null, 0, 0, 0);
    expect(isInMusola(AGENT)).toBe(false);
    // Walk (teleport via a huge dt) to the musola's upper-floor center.
    movement.moveTo(AGENT, [{ x: MUSOLA_CX, z: MUSOLA_CZ, y: FLOOR_HEIGHT }]);
    movement.update(1000);
    expect(agentRoomId(AGENT)).toBe("musola");
    expect(isInMusola(AGENT)).toBe(true);
  });

  it("agentRoomId matches roomIdAtPosition for a ground position", () => {
    movement.register(AGENT, null, 0, 0, 0);
    expect(agentRoomId(AGENT)).toBe(roomIdAtPosition(0, 0, 0));
  });
});
