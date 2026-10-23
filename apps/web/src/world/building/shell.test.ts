import { describe, expect, it } from "vitest";
import {
  BUILDING,
  CAMERA_PRESETS,
  FLOOR_HEIGHT,
  RECOVERY_BEDS,
  RECOVERY_ROOM_ID,
  ROOM_BY_ID,
  ROOMS,
  SLAB_T,
  WALL_H,
  WORKSTATIONS,
  type FloorMode,
} from "./floorPlan";

describe("floorPlan constants", () => {
  it("dimensions are sane", () => {
    expect(FLOOR_HEIGHT).toBeGreaterThan(0);
    expect(WALL_H).toBeGreaterThan(0);
    expect(SLAB_T).toBeGreaterThan(0);
    expect(SLAB_T).toBeLessThan(FLOOR_HEIGHT);
  });

  it("building bounds are ordered", () => {
    expect(BUILDING.minX).toBeLessThan(BUILDING.maxX);
    expect(BUILDING.minZ).toBeLessThan(BUILDING.maxZ);
  });

  it("all room rects are inside the building bounds", () => {
    for (const r of ROOMS) {
      expect(r.minX, `${r.id} minX < maxX`).toBeLessThan(r.maxX);
      expect(r.minZ, `${r.id} minZ < maxZ`).toBeLessThan(r.maxZ);
      expect(r.minX, `${r.id} within building`).toBeGreaterThanOrEqual(BUILDING.minX);
      expect(r.maxX, `${r.id} within building`).toBeLessThanOrEqual(BUILDING.maxX);
      expect(r.minZ, `${r.id} within building`).toBeGreaterThanOrEqual(BUILDING.minZ);
      expect(r.maxZ, `${r.id} within building`).toBeLessThanOrEqual(BUILDING.maxZ);
    }
  });

  it("room ids are unique and ROOM_BY_ID is consistent", () => {
    expect(new Set(ROOMS.map((r) => r.id)).size).toBe(ROOMS.length);
    for (const r of ROOMS) {
      expect(ROOM_BY_ID[r.id]).toBe(r);
    }
  });

  it("recovery beds are inside the ground-floor recovery room rect", () => {
    const room = ROOM_BY_ID[RECOVERY_ROOM_ID];
    expect(room).toBeDefined();
    expect(RECOVERY_ROOM_ID).toBe("recovery");
    expect(RECOVERY_BEDS).toHaveLength(4);
    const ids = RECOVERY_BEDS.map((b) => b.id);
    expect(ids).toEqual(["bed-01", "bed-02", "bed-03", "bed-04"]);
    for (const bed of RECOVERY_BEDS) {
      expect(bed.roomId, `${bed.id} roomId`).toBe(room.id);
      const [x, , z] = bed.position;
      expect(x, `${bed.id} x`).toBeGreaterThanOrEqual(room.minX);
      expect(x, `${bed.id} x`).toBeLessThanOrEqual(room.maxX);
      expect(z, `${bed.id} z`).toBeGreaterThanOrEqual(room.minZ);
      expect(z, `${bed.id} z`).toBeLessThanOrEqual(room.maxZ);
    }
    expect(RECOVERY_BEDS[0]!.position).toEqual([-7.3, 0, -10.8]);
    expect(RECOVERY_BEDS[1]!.position).toEqual([-5.45, 0, -10.8]);
    expect(RECOVERY_BEDS[2]!.position).toEqual([-3.6, 0, -10.8]);
    expect(RECOVERY_BEDS[3]!.position).toEqual([-1.75, 0, -10.8]);
  });

  it("workstations are inside their room rects", () => {
    const ids = Object.keys(WORKSTATIONS);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const w = WORKSTATIONS[id];
      const room = ROOM_BY_ID[w.roomId];
      expect(room, `${id} room ${w.roomId} exists`).toBeDefined();
      expect(room.floor, `${id} floor matches room`).toBe(w.floor);
      const [x, y, z] = w.position;
      expect(x, `${id} x`).toBeGreaterThanOrEqual(room.minX);
      expect(x, `${id} x`).toBeLessThanOrEqual(room.maxX);
      expect(z, `${id} z`).toBeGreaterThanOrEqual(room.minZ);
      expect(z, `${id} z`).toBeLessThanOrEqual(room.maxZ);
      expect(y, `${id} y matches floor`).toBe(w.floor === 0 ? 0 : FLOOR_HEIGHT);
    }
  });

  it("ws-01..ws-08 sit at the user's desk coordinates", () => {
    const expected: Record<string, [number, number]> = {
      "ws-01": [-4, -1.3],
      "ws-02": [-2, -1.3],
      "ws-03": [2, -1.3],
      "ws-04": [4, -1.3],
      "ws-05": [-4, 1.3],
      "ws-06": [-2, 1.3],
      "ws-07": [2, 1.3],
      "ws-08": [4, 1.3],
    };
    for (const [id, [x, z]] of Object.entries(expected)) {
      const w = WORKSTATIONS[id];
      expect(w, `missing ${id}`).toBeDefined();
      expect(w.position[0], `${id} x`).toBe(x);
      expect(w.position[2], `${id} z`).toBe(z);
      expect(w.rotationY, `${id} rotationY`).toBe(0);
      expect(w.roomId, `${id} roomId`).toBe("workspace");
      expect(w.floor, `${id} floor`).toBe(0);
    }
  });
});

describe("single-floor 10-room plan (user's code, faithful)", () => {
  it("has exactly the 10 expected rooms, all on floor 0", () => {
    expect(ROOMS).toHaveLength(10);
    const ids = new Set(ROOMS.map((r) => r.id));
    for (const id of [
      "musola",
      "recovery",
      "pantry",
      "toilet_pria",
      "toilet_wanita",
      "server",
      "project",
      "workspace",
      "lobby",
      "meeting",
    ]) {
      expect(ids, `missing room "${id}"`).toContain(id);
    }
    for (const r of ROOMS) {
      expect(r.floor, `${r.id} is ground floor`).toBe(0);
    }
  });

  it("room rects match the user's coordinates", () => {
    const rect = (id: string) => {
      const r = ROOM_BY_ID[id];
      return [r.minX, r.maxX, r.minZ, r.maxZ];
    };
    expect(rect("musola")).toEqual([-16, -8, -12, -4.5]);
    expect(rect("recovery")).toEqual([-8, 0.5, -12, -4.5]);
    expect(rect("pantry")).toEqual([0.5, 8, -12, -4.5]);
    expect(rect("toilet_pria")).toEqual([8, 10, -12, -4.5]);
    expect(rect("toilet_wanita")).toEqual([10, 12, -12, -4.5]);
    expect(rect("server")).toEqual([12, 16, -12, -4.5]);
    expect(rect("project")).toEqual([-16, -6.5, 1, 10]);
    expect(rect("workspace")).toEqual([-6.5, 9.5, -4.5, 6]);
    expect(rect("lobby")).toEqual([-6.5, 9.5, 6, 10]);
    expect(rect("meeting")).toEqual([9.5, 16, -1.8, 10]);
  });

  it("doors sit on the expected walls at the expected coordinates", () => {
    const door = (id: string) => ROOM_BY_ID[id].door!;
    expect(door("musola")).toMatchObject({ x: -12.5, z: -4.5, wall: "south" });
    expect(door("recovery")).toMatchObject({ x: -0.3, z: -4.5, wall: "south" });
    expect(door("pantry")).toMatchObject({ x: 1.8, z: -4.5, wall: "south", arch: true });
    expect(door("toilet_pria")).toMatchObject({ x: 8.8, z: -4.5, wall: "south" });
    expect(door("toilet_wanita")).toMatchObject({ x: 10.8, z: -4.5, wall: "south" });
    expect(door("server")).toMatchObject({ x: 13.2, z: -4.5, wall: "south" });
    expect(door("project")).toMatchObject({ x: -6.5, z: 3.0, wall: "east" });
    expect(door("meeting")).toMatchObject({ x: 9.5, z: 2.0, wall: "west" });
    expect(door("lobby")).toMatchObject({ x: 0, z: 10, wall: "south" });
    // Workspace is open — no door.
    expect(ROOM_BY_ID["workspace"].door).toBeNull();
  });

  it("room names are the user's Indonesian labels", () => {
    const name = (id: string) => ROOM_BY_ID[id].name;
    expect(name("musola")).toBe("Musola");
    expect(name("recovery")).toBe("Ruang Recovery");
    expect(name("pantry")).toBe("Pantry");
    expect(name("toilet_pria")).toBe("Toilet Pria");
    expect(name("toilet_wanita")).toBe("Toilet Wanita");
    expect(name("server")).toBe("Ruang Server");
    expect(name("project")).toBe("Ruang Project");
    expect(name("workspace")).toBe("Workspace");
    expect(name("lobby")).toBe("Resepsionis");
    expect(name("meeting")).toBe("Ruang Meeting");
  });

  it("room rects do not overlap (shared edges only)", () => {
    for (let i = 0; i < ROOMS.length; i++) {
      for (let j = i + 1; j < ROOMS.length; j++) {
        const a = ROOMS[i];
        const b = ROOMS[j];
        const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
        const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
        const areaOverlap = overlapX > 0 && overlapZ > 0;
        expect(areaOverlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });
});

describe("camera presets (single floor)", () => {
  const modes: FloorMode[] = ["office", "outdoor"];

  it("has exactly the office + outdoor presets", () => {
    expect(Object.keys(CAMERA_PRESETS).sort()).toEqual(["office", "outdoor"]);
  });

  it("every preset is sane (finite numbers, above the floor, looking at the building)", () => {
    for (const mode of modes) {
      const p = CAMERA_PRESETS[mode];
      for (const v of [...p.position, ...p.target]) {
        expect(Number.isFinite(v), `${mode} has a non-finite value`).toBe(true);
      }
      expect(p.position[1], `${mode} camera height`).toBeGreaterThan(2);
      expect(p.target[0], `${mode} target x`).toBeGreaterThanOrEqual(BUILDING.minX);
      expect(p.target[0], `${mode} target x`).toBeLessThanOrEqual(BUILDING.maxX);
      expect(p.target[2], `${mode} target z`).toBeGreaterThanOrEqual(BUILDING.minZ);
      expect(p.target[2], `${mode} target z`).toBeLessThanOrEqual(BUILDING.maxZ);
    }
  });

  it("office preset frames the whole 32x22 building", () => {
    const p = CAMERA_PRESETS.office;
    const dist = Math.hypot(
      p.position[0] - p.target[0],
      p.position[1] - p.target[1],
      p.position[2] - p.target[2],
    );
    // Building diagonal half-extent ≈ 19.4 — the camera must sit well
    // outside it to frame the whole floor.
    expect(dist).toBeGreaterThan(20);
    expect(dist).toBeLessThan(60);
  });
});
