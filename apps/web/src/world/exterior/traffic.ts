/**
 * Road loop + traffic math (pure, unit-tested).
 *
 * The road is a rounded-rectangle ring around the building, sized to
 * clear everything already outside: the south edge sits past the
 * entrance asphalt strip (which ends at z=24), the other edges clear
 * the walls by 2.5-3.5 m. Centerline rect: x ±22, z -19..28
 * (center z 4.5, halfZ 23.5), corner radius 6 m, road width 7 m.
 *
 * Two lanes, Indonesian left-hand traffic: the outer lane runs the
 * loop in direction +1 (east on the north edge, west on the south
 * edge), the inner lane runs it in reverse. Lane centerlines are the
 * centerline rect expanded/shrunk by LANE_OFFSET (straight lengths
 * stay identical; only the arc radii change).
 *
 * Yaw convention: a model facing local +z needs rotationY =
 * atan2(dx, dz) for travel direction (dx, dz). A model whose front
 * is -z gets an extra PI (see VEHICLE_FRONT).
 */

import type { PolyFile } from "../PolyModel";

export interface LoopSpec {
  cx: number;
  cz: number;
  halfX: number;
  halfZ: number;
  radius: number;
}

/** Road centerline loop. */
export const ROAD_CENTER: LoopSpec = {
  cx: 0,
  cz: 4.5,
  halfX: 22,
  halfZ: 23.5,
  radius: 6,
};

export const ROAD_HALF_WIDTH = 3.5;
export const LANE_OFFSET = 1.9;

export type Lane = "outer" | "inner";

export function laneLoop(lane: Lane): LoopSpec {
  const d = lane === "outer" ? LANE_OFFSET : -LANE_OFFSET;
  return {
    cx: ROAD_CENTER.cx,
    cz: ROAD_CENTER.cz,
    halfX: ROAD_CENTER.halfX + d,
    halfZ: ROAD_CENTER.halfZ + d,
    radius: ROAD_CENTER.radius + d,
  };
}

export function loopLength(loop: LoopSpec): number {
  const straights =
    2 * (2 * (loop.halfX - loop.radius)) +
    2 * (2 * (loop.halfZ - loop.radius));
  return straights + 2 * Math.PI * loop.radius;
}

interface Segment {
  kind: "straight" | "arc";
  length: number;
  /** Straight: fixed direction. Arc: center + start angle. */
  dx: number;
  dz: number;
  cx: number;
  cz: number;
  a0: number;
  x0: number;
  z0: number;
}

function segments(loop: LoopSpec): Segment[] {
  const { cx, cz, halfX: hx, halfZ: hz, radius: r } = loop;
  const sx = 2 * (hx - r);
  const sz = 2 * (hz - r);
  const arc = (Math.PI * r) / 2;
  return [
    // North edge, west -> east (+x).
    { kind: "straight", length: sx, dx: 1, dz: 0, cx: 0, cz: 0, a0: 0, x0: cx - hx + r, z0: cz - hz },
    // NE corner: center (cx+hx-r, cz-hz+r), angle -90deg -> 0.
    { kind: "arc", length: arc, dx: 0, dz: 0, cx: cx + hx - r, cz: cz - hz + r, a0: -Math.PI / 2, x0: 0, z0: 0 },
    // East edge, north -> south (+z).
    { kind: "straight", length: sz, dx: 0, dz: 1, cx: 0, cz: 0, a0: 0, x0: cx + hx, z0: cz - hz + r },
    // SE corner: angle 0 -> 90deg.
    { kind: "arc", length: arc, dx: 0, dz: 0, cx: cx + hx - r, cz: cz + hz - r, a0: 0, x0: 0, z0: 0 },
    // South edge, east -> west (-x).
    { kind: "straight", length: sx, dx: -1, dz: 0, cx: 0, cz: 0, a0: 0, x0: cx + hx - r, z0: cz + hz },
    // SW corner: angle 90deg -> 180deg.
    { kind: "arc", length: arc, dx: 0, dz: 0, cx: cx - hx + r, cz: cz + hz - r, a0: Math.PI / 2, x0: 0, z0: 0 },
    // West edge, south -> north (-z).
    { kind: "straight", length: sz, dx: 0, dz: -1, cx: 0, cz: 0, a0: 0, x0: cx - hx, z0: cz + hz - r },
    // NW corner: angle 180deg -> 270deg.
    { kind: "arc", length: arc, dx: 0, dz: 0, cx: cx - hx + r, cz: cz - hz + r, a0: Math.PI, x0: 0, z0: 0 },
  ];
}

function loopPointForward(
  loop: LoopSpec,
  s: number,
): { x: number; z: number; heading: number } {
  const segs = segments(loop);
  let rest = s;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (rest <= seg.length || i === segs.length - 1) {
      if (seg.kind === "straight") {
        return {
          x: seg.x0 + seg.dx * rest,
          z: seg.z0 + seg.dz * rest,
          heading: Math.atan2(seg.dx, seg.dz),
        };
      }
      const a = seg.a0 + rest / loop.radius;
      const dx = -Math.sin(a);
      const dz = Math.cos(a);
      return {
        x: seg.cx + loop.radius * Math.cos(a),
        z: seg.cz + loop.radius * Math.sin(a),
        heading: Math.atan2(dx, dz),
      };
    }
    rest -= seg.length;
  }
  // Unreachable: s is normalized below.
  return { x: loop.cx, z: loop.cz, heading: 0 };
}

/**
 * Point + travel heading at distance `s` along the loop.
 * direction +1 follows the segment order above; -1 traverses the
 * same loop backwards (same points, heading flipped).
 */
export function loopPoint(
  loop: LoopSpec,
  s: number,
  direction: 1 | -1 = 1,
): { x: number; z: number; heading: number } {
  const total = loopLength(loop);
  const t = ((s % total) + total) % total;
  if (direction === -1) {
    const p = loopPointForward(loop, (total - t) % total);
    return { x: p.x, z: p.z, heading: p.heading + Math.PI };
  }
  return loopPointForward(loop, t);
}

/**
 * Which way each model faces in its own local space: +1 = front is
 * local +z, -1 = front is local -z. Measured where the geometry
 * proves it (motorbike: headlight mesh at +z; pickup: cab at -z,
 * and a pickup's cab is its front). The rest are assumed +z — if a
 * screenshot shows one driving backwards, flip its sign here.
 */
export const VEHICLE_FRONT: Record<string, 1 | -1> = {
  "car-blue.glb": 1,
  "sedan-grey.glb": 1,
  "pickup.glb": -1,
  "motorbike.glb": 1,
  "bus.glb": 1,
  "van-white.glb": 1,
};

export interface TrafficVehicle {
  file: PolyFile;
  lane: Lane;
  /** m/s. */
  speed: number;
  /** Start distance along its lane loop. */
  offset: number;
}

/** 7 vehicles: outer loop 4 (spaced >= 30 m), inner loop 3 (spaced 45 m). */
export const TRAFFIC_VEHICLES: TrafficVehicle[] = [
  { file: "car-blue.glb", lane: "outer", speed: 6, offset: 0 },
  { file: "bus.glb", lane: "outer", speed: 4.5, offset: 55 },
  { file: "pickup.glb", lane: "outer", speed: 6.5, offset: 110 },
  { file: "motorbike.glb", lane: "outer", speed: 8.5, offset: 150 },
  { file: "van-white.glb", lane: "inner", speed: 5.5, offset: 0 },
  { file: "sedan-grey.glb", lane: "inner", speed: 7, offset: 45 },
  { file: "motorbike.glb", lane: "inner", speed: 8, offset: 95 },
];

/** Road surface height (top of the road boxes). */
export const ROAD_TOP_Y = -0.22;

/** Beyond this camera distance a vehicle group is hidden. */
export const TRAFFIC_CULL_DISTANCE = 80;
