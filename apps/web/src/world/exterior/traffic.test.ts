import { describe, expect, it } from "vitest";
import {
  LANE_OFFSET,
  ROAD_CENTER,
  TRAFFIC_VEHICLES,
  VEHICLE_FRONT,
  laneLoop,
  loopLength,
  loopPoint,
} from "./traffic";

const TAU = Math.PI * 2;

describe("road loop geometry", () => {
  it("length = straights + full circle of arcs", () => {
    const loop = ROAD_CENTER;
    const expected =
      2 * (2 * (loop.halfX - loop.radius)) +
      2 * (2 * (loop.halfZ - loop.radius)) +
      TAU * loop.radius;
    expect(loopLength(loop)).toBeCloseTo(expected, 9);
  });

  it("closes: point at 0 equals point at full length", () => {
    const loop = ROAD_CENTER;
    const a = loopPoint(loop, 0);
    const b = loopPoint(loop, loopLength(loop));
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.z).toBeCloseTo(a.z, 6);
  });

  it("headings match the four straight edges", () => {
    const loop = ROAD_CENTER;
    const sx = 2 * (loop.halfX - loop.radius);
    const arc = (Math.PI * loop.radius) / 2;
    // North edge midpoint: heading +x -> yaw atan2(1,0) = PI/2.
    expect(loopPoint(loop, sx / 2).heading).toBeCloseTo(Math.PI / 2, 6);
    // East edge midpoint: heading +z -> yaw 0.
    const eastMid = sx + arc + (2 * (loop.halfZ - loop.radius)) / 2;
    expect(loopPoint(loop, eastMid).heading).toBeCloseTo(0, 6);
    // South edge midpoint: heading -x -> yaw -PI/2.
    const southMid = sx + arc + 2 * (loop.halfZ - loop.radius) + arc + sx / 2;
    expect(loopPoint(loop, southMid).heading).toBeCloseTo(-Math.PI / 2, 6);
    // West edge midpoint: heading -z -> yaw PI.
    const westMid =
      sx + arc + 2 * (loop.halfZ - loop.radius) + arc + sx + arc + (2 * (loop.halfZ - loop.radius)) / 2;
    expect(Math.abs(loopPoint(loop, westMid).heading)).toBeCloseTo(Math.PI, 6);
  });

  it("reverse direction visits the same points with flipped heading", () => {
    const loop = ROAD_CENTER;
    const total = loopLength(loop);
    const fwd = loopPoint(loop, 30, 1);
    const rev = loopPoint(loop, total - 30, -1);
    expect(rev.x).toBeCloseTo(fwd.x, 6);
    expect(rev.z).toBeCloseTo(fwd.z, 6);
    const diff = Math.abs(((rev.heading - fwd.heading + Math.PI) % TAU) - Math.PI);
    expect(diff).toBeCloseTo(Math.PI, 6);
  });

  it("lane loops keep straight lengths, only arc radii change", () => {
    const outer = laneLoop("outer");
    const inner = laneLoop("inner");
    expect(outer.halfX - outer.radius).toBeCloseTo(ROAD_CENTER.halfX - ROAD_CENTER.radius, 9);
    expect(inner.halfX - inner.radius).toBeCloseTo(ROAD_CENTER.halfX - ROAD_CENTER.radius, 9);
    expect(outer.radius).toBe(ROAD_CENTER.radius + LANE_OFFSET);
    expect(inner.radius).toBe(ROAD_CENTER.radius - LANE_OFFSET);
    expect(loopLength(outer)).toBeGreaterThan(loopLength(inner));
  });

  it("loop points stay on the rounded rectangle (no corner cutting)", () => {
    const loop = ROAD_CENTER;
    const total = loopLength(loop);
    for (let s = 0; s < total; s += 0.5) {
      const p = loopPoint(loop, s);
      // Distance from the loop center must stay within the rect bounds.
      expect(Math.abs(p.x - loop.cx)).toBeLessThanOrEqual(loop.halfX + 0.01);
      expect(Math.abs(p.z - loop.cz)).toBeLessThanOrEqual(loop.halfZ + 0.01);
    }
  });
});

describe("traffic fleet", () => {
  it("every vehicle file has a known front direction", () => {
    for (const v of TRAFFIC_VEHICLES) {
      expect(VEHICLE_FRONT[v.file]).toBeDefined();
      expect([1, -1]).toContain(VEHICLE_FRONT[v.file]);
    }
  });

  it("offsets fit their lane loop and speeds are sane", () => {
    for (const v of TRAFFIC_VEHICLES) {
      expect(v.offset).toBeGreaterThanOrEqual(0);
      expect(v.offset).toBeLessThan(loopLength(laneLoop(v.lane)));
      expect(v.speed).toBeGreaterThan(0);
      expect(v.speed).toBeLessThanOrEqual(12);
    }
  });

  it("same-lane vehicles are spaced at least 25 m apart", () => {
    for (const lane of ["outer", "inner"] as const) {
      const total = loopLength(laneLoop(lane));
      const offsets = TRAFFIC_VEHICLES.filter((v) => v.lane === lane)
        .map((v) => v.offset)
        .sort((a, b) => a - b);
      for (let i = 0; i < offsets.length; i++) {
        const next = offsets[(i + 1) % offsets.length];
        const gap = (next - offsets[i] + total) % total;
        expect(gap).toBeGreaterThanOrEqual(25);
      }
    }
  });
});
