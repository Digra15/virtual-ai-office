/**
 * Straight road + traffic math (pure, unit-tested).
 *
 * The road runs straight east-west IN FRONT of the office (south
 * side), replacing the earlier ring road around the building at the
 * user's request. Centerline z=28, width 7 m: it clears the entrance
 * asphalt strip (which ends at z=24) by 0.5 m. Length 140 m
 * (x -70..70), inside the 160 m ground plane.
 *
 * Two lanes, Indonesian left-hand traffic: the north lane (z=26.1,
 * office side) runs eastbound (+x), the south lane (z=29.9) runs
 * westbound (-x). Vehicles wrap around: distance s is modulo the
 * road length, so a vehicle leaving one end re-enters at the other.
 *
 * Yaw convention: a model facing local +z needs rotationY =
 * atan2(dx, dz) for travel direction (dx, dz). A model whose front
 * is -z gets an extra PI (see VEHICLE_FRONT).
 */

import type { PolyFile } from "../PolyModel";

/** Straight road definition. */
export const ROAD_LINE = {
  xMin: -70,
  xMax: 70,
  centerZ: 28,
  halfWidth: 3.5,
  laneOffset: 1.9,
};

export const ROAD_LENGTH = ROAD_LINE.xMax - ROAD_LINE.xMin;

export type Lane = "north" | "south";

/** Lane centerline z. North = office side = eastbound. */
export function laneZ(lane: Lane): number {
  return ROAD_LINE.centerZ + (lane === "north" ? -ROAD_LINE.laneOffset : ROAD_LINE.laneOffset);
}

/** Travel heading (yaw) for a lane: north -> +x, south -> -x. */
export function laneHeading(lane: Lane): number {
  return lane === "north" ? Math.PI / 2 : -Math.PI / 2;
}

/** Point + heading at distance `s` along a lane (s wraps modulo length). */
export function straightPoint(
  lane: Lane,
  s: number,
): { x: number; z: number; heading: number } {
  const t = ((s % ROAD_LENGTH) + ROAD_LENGTH) % ROAD_LENGTH;
  const x = lane === "north" ? ROAD_LINE.xMin + t : ROAD_LINE.xMax - t;
  return { x, z: laneZ(lane), heading: laneHeading(lane) };
}

/**
 * Which way each model faces in its own local space: +1 = front is
 * local +z, -1 = front is local -z. All 8 user-supplied models face
 * +z by measurement: Quaternius/Kay front wheels sit at +z, the
 * Camaro's front plate + grille logo sit at +z (exhaust + spoiler
 * at -z), the Poly car's long front wiper blades sit at +z. The
 * Jeep is the only assumed one (single merged mesh, no separable
 * parts) — if it drives backwards, flip its sign here.
 */
export const VEHICLE_FRONT: Record<string, 1 | -1> = {
  "camaro.glb": 1,
  "car-poly.glb": 1,
  "jeep.glb": 1,
  "taxi-quaternius.glb": 1,
  "taxi-kay.glb": 1,
  "police-car.glb": 1,
  "sports-car.glb": 1,
  "suv.glb": 1,
};

export interface TrafficVehicle {
  file: PolyFile;
  lane: Lane;
  /** m/s. */
  speed: number;
  /** Start distance along the road. */
  offset: number;
  /** PolyModel scale against the raw bbox (1 = real meters). */
  scale: number;
}

/**
 * 8 vehicles from the user, 4 per lane, spaced 35 m apart. Speeds
 * are EQUAL within a lane on purpose: with different speeds the
 * faster car catches the slower one ahead and they overlap (there
 * is no car-following logic — vehicles just wrap). Equal speeds
 * keep the 35 m gaps constant forever.
 */
export const TRAFFIC_VEHICLES: TrafficVehicle[] = [
  { file: "camaro.glb", lane: "north", speed: 6.5, offset: 0, scale: 1 },
  { file: "police-car.glb", lane: "north", speed: 6.5, offset: 35, scale: 1 },
  { file: "taxi-quaternius.glb", lane: "north", speed: 6.5, offset: 70, scale: 1 },
  { file: "suv.glb", lane: "north", speed: 6.5, offset: 105, scale: 1 },
  { file: "sports-car.glb", lane: "south", speed: 6, offset: 0, scale: 1 },
  { file: "taxi-kay.glb", lane: "south", speed: 6, offset: 35, scale: 4.47 },
  { file: "car-poly.glb", lane: "south", speed: 6, offset: 70, scale: 0.02 },
  { file: "jeep.glb", lane: "south", speed: 6, offset: 105, scale: 0.047 },
];

/** Road surface height (top of the road box). */
export const ROAD_TOP_Y = -0.22;

/** Beyond this camera distance a vehicle group is hidden. */
export const TRAFFIC_CULL_DISTANCE = 80;
