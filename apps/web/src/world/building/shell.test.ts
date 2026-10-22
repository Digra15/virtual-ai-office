import { describe, expect, it } from "vitest";
import {
  BUILDING,
  FLOOR_HEIGHT,
  RECOVERY_BEDS,
  ROOM_BY_ID,
  ROOMS,
  SLAB_T,
  STAIR_TOWER,
  WALL_H,
  WORKSTATIONS,
} from "./floorPlan";

describe("floorPlan constants", () => {
  it("dimensions are sane", () => {
    expect(FLOOR_HEIGHT).toBeGreaterThan(0);
    expect(WALL_H).toBeGreaterThan(0);
    expect(SLAB_T).toBeGreaterThan(0);
    expect(SLAB_T).toBeLessThan(FLOOR_HEIGHT);
    expect(WALL_H).toBeLessThan(FLOOR_HEIGHT * 2);
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
    const ids = ROOMS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of ROOMS) {
      expect(ROOM_BY_ID[r.id]).toBe(r);
    }
  });

  it("recovery beds are inside the upstairs recovery room rect", () => {
    const room = ROOM_BY_ID["pemulihan"];
    expect(room).toBeDefined();
    expect(RECOVERY_BEDS.length).toBeGreaterThan(0);
    for (const bed of RECOVERY_BEDS) {
      expect(bed.roomId, `${bed.id} roomId`).toBe(room.id);
      const [x, , z] = bed.position;
      expect(x, `${bed.id} x`).toBeGreaterThanOrEqual(room.minX);
      expect(x, `${bed.id} x`).toBeLessThanOrEqual(room.maxX);
      expect(z, `${bed.id} z`).toBeGreaterThanOrEqual(room.minZ);
      expect(z, `${bed.id} z`).toBeLessThanOrEqual(room.maxZ);
    }
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

  it("stair tower is adjacent to the building east wall", () => {
    expect(STAIR_TOWER.minX).toBe(BUILDING.maxX);
    expect(STAIR_TOWER.maxX).toBeGreaterThan(STAIR_TOWER.minX);
    // z range overlaps the building
    expect(STAIR_TOWER.minZ).toBeLessThan(BUILDING.maxZ);
    expect(STAIR_TOWER.maxZ).toBeGreaterThan(BUILDING.minZ);
  });

  it("stair tower doors and waypoints are inside the tower", () => {
    for (const d of [STAIR_TOWER.groundDoor, STAIR_TOWER.upperDoor]) {
      expect(d.x).toBe(BUILDING.maxX);
      expect(d.z).toBeGreaterThanOrEqual(STAIR_TOWER.minZ);
      expect(d.z).toBeLessThanOrEqual(STAIR_TOWER.maxZ);
    }
    expect(STAIR_TOWER.base.y).toBe(0);
    expect(STAIR_TOWER.mid.y).toBe(FLOOR_HEIGHT / 2);
    expect(STAIR_TOWER.top.y).toBe(FLOOR_HEIGHT);
    for (const w of [STAIR_TOWER.base, STAIR_TOWER.mid, STAIR_TOWER.top]) {
      expect(w.x).toBeGreaterThanOrEqual(STAIR_TOWER.minX);
      expect(w.x).toBeLessThanOrEqual(STAIR_TOWER.maxX);
      expect(w.z).toBeGreaterThanOrEqual(STAIR_TOWER.minZ);
      expect(w.z).toBeLessThanOrEqual(STAIR_TOWER.maxZ);
    }
  });

  it("denah plan: exactly 14 rooms on 2 floors (7 + 7), musola included", () => {
    expect(ROOMS).toHaveLength(14);
    const ids = new Set(ROOMS.map((r) => r.id));
    for (const id of [
      "reception",
      "openWorkspace",
      "meeting",
      "server",
      "restroom",
      "pantry",
      "project",
      "direksi",
      "konten",
      "musola",
      "fokus",
      "lounge",
      "pemulihan",
      "rnd",
    ]) {
      expect(ids, `missing room "${id}"`).toContain(id);
    }
    const ground = ROOMS.filter((r) => r.floor === 0);
    const upper = ROOMS.filter((r) => r.floor === 1);
    expect(ground).toHaveLength(7);
    expect(upper).toHaveLength(7);
    // Cut rooms must stay gone.
    for (const id of ["pmRoom", "executive", "lab", "training", "terrace", "lounge2", "overflow", "corridor", "studio", "conferenceRoom", "recoveryRoom", "restrooms", "focus1"]) {
      expect(ids, `cut room "${id}" reappeared`).not.toContain(id);
    }
  });
});
