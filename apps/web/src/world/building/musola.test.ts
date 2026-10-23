/**
 * Musola contract tests (single floor, 2026-10-23).
 *
 * The floorPlan contract below is final: the musola is a ground-floor
 * room (x -16..-9, z -12..-4.5, id "musola"). The barrel assertion
 * requires the room-visual track's rewritten rooms/ barrel to include
 * the Musola component.
 */
import { describe, expect, it } from "vitest";
import {
  RECOVERY_BEDS,
  RECOVERY_ROOM_ID,
  ROOM_BY_ID,
  ROOMS,
  roomAt,
} from "./floorPlan";

describe("musola room contract", () => {
  it("ROOMS contains the ground-floor musola room", () => {
    const musola = ROOMS.find((r) => r.id === "musola");
    expect(musola).toBeDefined();
    expect(musola!.floor).toBe(0);
    expect(musola!.type).toBe("musola");
    expect(ROOM_BY_ID["musola"]).toBe(musola);
  });

  it("roomAt(-12, -8, 0) resolves inside the musola rect", () => {
    const musola = ROOM_BY_ID["musola"];
    expect(musola).toBeDefined();
    expect(-12).toBeGreaterThanOrEqual(musola.minX);
    expect(-12).toBeLessThanOrEqual(musola.maxX);
    expect(-8).toBeGreaterThanOrEqual(musola.minZ);
    expect(-8).toBeLessThanOrEqual(musola.maxZ);
    expect(roomAt(-12, -8, 0)?.id).toBe("musola");
  });

  it("the musola door sits on its south wall into the corridor", () => {
    const musola = ROOM_BY_ID["musola"];
    expect(musola.door).toMatchObject({ x: -12.5, z: -4.5, wall: "south" });
  });

  it("RECOVERY_BEDS are all inside the ground-floor recovery room", () => {
    expect(RECOVERY_BEDS.length).toBeGreaterThan(0);
    const room = ROOM_BY_ID[RECOVERY_ROOM_ID];
    expect(room).toBeDefined();
    expect(room.floor).toBe(0);
    for (const bed of RECOVERY_BEDS) {
      expect(bed.roomId).toBe(RECOVERY_ROOM_ID);
      const [x, , z] = bed.position;
      expect(x).toBeGreaterThanOrEqual(room.minX);
      expect(x).toBeLessThanOrEqual(room.maxX);
      expect(z).toBeGreaterThanOrEqual(room.minZ);
      expect(z).toBeLessThanOrEqual(room.maxZ);
    }
  });

  it("ROOM_COMPONENTS['musola'] is defined", async () => {
    const { ROOM_COMPONENTS } = await import("./rooms");
    expect(ROOM_COMPONENTS["musola"]).toBeDefined();
  });
});
