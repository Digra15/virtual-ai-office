/**
 * Room data-layer tests (no visuals):
 * 1. Every WORKSTATIONS entry lies inside its room's rect (roomAt agrees).
 * 2. Every RECOVERY_BEDS entry lies inside the recovery room rect.
 *
 * NOTE: visual coverage ("every ROOMS id has a component in the rooms
 * barrel") belongs to the room-visual track — the barrel is being
 * rewritten for the single-floor plan and is intentionally not asserted
 * here.
 */
import { describe, expect, it } from "vitest";
import {
  RECOVERY_BEDS,
  RECOVERY_ROOM_ID,
  ROOM_BY_ID,
  WORKSTATIONS,
  roomAt,
} from "./floorPlan";

function inside(
  x: number,
  z: number,
  room: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  return x >= room.minX && x <= room.maxX && z >= room.minZ && z <= room.maxZ;
}

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

describe("recovery bed placement", () => {
  it("every bed lies inside the recovery room rect", () => {
    const room = ROOM_BY_ID[RECOVERY_ROOM_ID];
    expect(room).toBeDefined();
    expect(RECOVERY_BEDS.length).toBeGreaterThan(0);
    for (const bed of RECOVERY_BEDS) {
      const [x, , z] = bed.position;
      expect(inside(x, z, room), `${bed.id} outside "${RECOVERY_ROOM_ID}"`).toBe(true);
    }
  });
});
