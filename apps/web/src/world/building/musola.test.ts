/**
 * Musola presence tests (2026-10-22 simplification).
 *
 * The floorPlan/navigation/store contracts below are final. The barrel
 * assertion requires the builder's rewritten rooms/ barrel to include
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
  it("ROOMS contains a musola room on the second floor", () => {
    const musola = ROOMS.find((r) => r.id === "musola");
    expect(musola).toBeDefined();
    expect(musola!.floor).toBe(1);
    expect(musola!.type).toBe("musola");
    expect(ROOM_BY_ID["musola"]).toBe(musola);
  });

  it("roomAt(7, -9, 1) resolves inside the musola rect", () => {
    const musola = ROOM_BY_ID["musola"];
    expect(musola).toBeDefined();
    expect(7).toBeGreaterThanOrEqual(musola.minX);
    expect(7).toBeLessThanOrEqual(musola.maxX);
    expect(-9).toBeGreaterThanOrEqual(musola.minZ);
    expect(-9).toBeLessThanOrEqual(musola.maxZ);
    expect(roomAt(7, -9, 1)?.id).toBe("musola");
  });

  it("RECOVERY_BEDS still all inside the recovery room", () => {
    expect(RECOVERY_BEDS.length).toBeGreaterThan(0);
    const room = ROOM_BY_ID[RECOVERY_ROOM_ID];
    expect(room).toBeDefined();
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
