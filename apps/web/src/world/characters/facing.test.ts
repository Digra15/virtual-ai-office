import { describe, expect, it, afterEach } from "vitest";
import {
  MUSOLA_ROOM_ID,
  agentRoomId,
  deskFacing,
  isInMusola,
  roomIdAtPosition,
} from "./facing";
import { movement } from "../movement";
import { ROOM_BY_ID } from "../building/floorPlan";

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
    // All 8 desks have rotationY 0 → nose toward −z (monitor side) = PI.
    for (const id of ["ws-01", "ws-02", "ws-03", "ws-04", "ws-05", "ws-06", "ws-07", "ws-08"]) {
      expect(deskFacing(id), id).toBeCloseTo(Math.PI, 10);
    }
  });

  it("covers the hot-desk workstations", () => {
    // stress desks also have rotationY 0 → nose PI.
    expect(deskFacing("stress-01")).toBeCloseTo(Math.PI, 10);
  });

  it("falls back to PI (face the room) for unknown ids", () => {
    expect(deskFacing("nope-99")).toBeCloseTo(Math.PI, 10);
  });
});

describe("roomIdAtPosition", () => {
  it("resolves the musola center on the single floor", () => {
    expect(roomIdAtPosition(MUSOLA_CX, 0, MUSOLA_CZ)).toBe("musola");
  });

  it("ignores the y parameter (single floor — no upstairs)", () => {
    expect(roomIdAtPosition(MUSOLA_CX, 5, MUSOLA_CZ)).toBe("musola");
    expect(roomIdAtPosition(MUSOLA_CX, 3.5, MUSOLA_CZ)).toBe("musola");
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
    // Walk (teleport via a huge dt) to the musola center.
    movement.moveTo(AGENT, [{ x: MUSOLA_CX, z: MUSOLA_CZ, y: 0 }]);
    movement.update(1000);
    expect(agentRoomId(AGENT)).toBe("musola");
    expect(isInMusola(AGENT)).toBe(true);
  });

  it("agentRoomId matches roomIdAtPosition for a ground position", () => {
    movement.register(AGENT, null, 0, 0, 0);
    expect(agentRoomId(AGENT)).toBe(roomIdAtPosition(0, 0, 0));
  });
});
