/**
 * Building room tests:
 * 1. Every floorPlan ROOMS id has a component in the rooms barrel.
 * 2. Every WORKSTATIONS entry lies inside its room's rect (roomAt agrees).
 * 3. Every RECOVERY_BEDS entry lies inside the recovery room rect.
 */
import { describe, expect, it } from "vitest";
import {
  RECOVERY_BEDS,
  RECOVERY_ROOM_ID,
  ROOM_BY_ID,
  ROOMS,
  WORKSTATIONS,
  roomAt,
} from "./floorPlan";
import { ROOM_COMPONENTS } from "./rooms";

function inside(
  x: number,
  z: number,
  room: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  return x >= room.minX && x <= room.maxX && z >= room.minZ && z <= room.maxZ;
}

describe("rooms barrel", () => {
  it("exports a component for every ROOMS id", () => {
    for (const room of ROOMS) {
      expect(
        ROOM_COMPONENTS[room.id],
        `missing component for room id "${room.id}"`,
      ).toBeDefined();
    }
  });

  it("covers exactly the ROOMS ids (no extras, no missing)", () => {
    expect(new Set(Object.keys(ROOM_COMPONENTS))).toEqual(
      new Set(ROOMS.map((r) => r.id)),
    );
  });
});

describe("workstation placement", () => {
  it("every workstation lies inside its room rect and roomAt agrees", () => {
    const ids = Object.keys(WORKSTATIONS);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const ws = WORKSTATIONS[id];
      const room = ROOM_BY_ID[ws.roomId];
      expect(room, `unknown roomId "${ws.roomId}" for ${id}`).toBeDefined();
      const [x, , z] = ws.position;
      expect(
        inside(x, z, room),
        `${id} at [${x}, ${z}] is outside room "${ws.roomId}"`,
      ).toBe(true);
      expect(roomAt(x, z, ws.floor)?.id).toBe(ws.roomId);
    }
  });
});

describe("recovery beds", () => {
  it("all four beds lie inside the upstairs recovery room rect", () => {
    expect(RECOVERY_BEDS).toHaveLength(4);
    const room = ROOM_BY_ID[RECOVERY_ROOM_ID];
    expect(room).toBeDefined();
    expect(room.floor).toBe(1);
    for (const bed of RECOVERY_BEDS) {
      expect(bed.roomId).toBe(RECOVERY_ROOM_ID);
      const [x, , z] = bed.position;
      expect(
        inside(x, z, room),
        `${bed.id} at [${x}, ${z}] is outside the recovery room`,
      ).toBe(true);
      expect(roomAt(x, z, 1)?.id).toBe(RECOVERY_ROOM_ID);
    }
  });
});
