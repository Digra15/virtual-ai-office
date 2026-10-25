import { describe, expect, it } from "vitest";
import {
  ROAD_LENGTH,
  ROAD_LINE,
  TRAFFIC_VEHICLES,
  VEHICLE_FRONT,
  laneHeading,
  laneZ,
  straightPoint,
} from "./traffic";

describe("straight road geometry", () => {
  it("road is 140 m long, centered in front of the office", () => {
    expect(ROAD_LENGTH).toBe(140);
    expect(ROAD_LINE.centerZ).toBe(28);
    expect(ROAD_LINE.centerZ - ROAD_LINE.halfWidth).toBeGreaterThanOrEqual(24);
  });

  it("north lane is the office side, south lane the far side", () => {
    expect(laneZ("north")).toBeLessThan(ROAD_LINE.centerZ);
    expect(laneZ("south")).toBeGreaterThan(ROAD_LINE.centerZ);
    expect(laneZ("south") - laneZ("north")).toBeCloseTo(2 * ROAD_LINE.laneOffset, 9);
  });

  it("north lane runs east (+x), south lane west (-x)", () => {
    expect(laneHeading("north")).toBeCloseTo(Math.PI / 2, 9);
    expect(laneHeading("south")).toBeCloseTo(-Math.PI / 2, 9);
    const a = straightPoint("north", 0);
    const b = straightPoint("north", 10);
    expect(b.x).toBeGreaterThan(a.x);
    expect(a.z).toBe(laneZ("north"));
    const c = straightPoint("south", 0);
    const d = straightPoint("south", 10);
    expect(d.x).toBeLessThan(c.x);
    expect(c.z).toBe(laneZ("south"));
  });

  it("distance wraps modulo the road length", () => {
    const a = straightPoint("north", 0);
    const b = straightPoint("north", ROAD_LENGTH);
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.z).toBeCloseTo(a.z, 9);
    const c = straightPoint("south", ROAD_LENGTH + 5);
    const d = straightPoint("south", 5);
    expect(c.x).toBeCloseTo(d.x, 9);
  });

  it("points stay on the road", () => {
    for (let s = 0; s < ROAD_LENGTH; s += 7) {
      for (const lane of ["north", "south"] as const) {
        const p = straightPoint(lane, s);
        expect(p.x).toBeGreaterThanOrEqual(ROAD_LINE.xMin - 0.01);
        expect(p.x).toBeLessThanOrEqual(ROAD_LINE.xMax + 0.01);
        expect(Math.abs(p.z - ROAD_LINE.centerZ)).toBeLessThanOrEqual(
          ROAD_LINE.halfWidth + 0.01,
        );
      }
    }
  });
});

describe("traffic fleet", () => {
  it("every vehicle file has a known front direction and a sane scale", () => {
    for (const v of TRAFFIC_VEHICLES) {
      expect(VEHICLE_FRONT[v.file]).toBeDefined();
      expect([1, -1]).toContain(VEHICLE_FRONT[v.file]);
      expect(v.scale).toBeGreaterThan(0);
    }
  });

  it("offsets fit the road and speeds are sane", () => {
    for (const v of TRAFFIC_VEHICLES) {
      expect(v.offset).toBeGreaterThanOrEqual(0);
      expect(v.offset).toBeLessThan(ROAD_LENGTH);
      expect(v.speed).toBeGreaterThan(0);
      expect(v.speed).toBeLessThanOrEqual(12);
    }
  });

  it("same-lane vehicles share one speed, so gaps never change", () => {
    for (const lane of ["north", "south"] as const) {
      const speeds = new Set(
        TRAFFIC_VEHICLES.filter((v) => v.lane === lane).map((v) => v.speed),
      );
      expect(speeds.size).toBe(1);
    }
  });

  it("same-lane vehicles are spaced at least 25 m apart", () => {
    for (const lane of ["north", "south"] as const) {
      const offsets = TRAFFIC_VEHICLES.filter((v) => v.lane === lane)
        .map((v) => v.offset)
        .sort((a, b) => a - b);
      for (let i = 0; i < offsets.length; i++) {
        const next = offsets[(i + 1) % offsets.length];
        const gap = (next - offsets[i] + ROAD_LENGTH) % ROAD_LENGTH;
        expect(gap).toBeGreaterThanOrEqual(25);
      }
    }
  });
});
