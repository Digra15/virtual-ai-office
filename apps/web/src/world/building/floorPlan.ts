/**
 * Data-driven floor plan for the two-story Virtual AI Office building.
 *
 * This file is the SINGLE SOURCE OF TRUTH for the building's spatial
 * design. Room components, the navigation graph, the occupancy store, the
 * camera presets, and the admin panel all read from here — never from
 * hardcoded coordinates scattered across components.
 *
 * Conventions:
 * - Ground floor: y = 0. Second floor slab top: y = FLOOR_HEIGHT.
 * - Wall height: WALL_H. All room rects are in world units (x, z).
 * - The original open-workspace desk block (layout.ts DESKS ws-01..ws-08
 *   and EXTRA_DESKS) is preserved untouched so spawn/wander logic keeps
 *   working; new workstations get ids like `studio-01`, `focus-01`.
 * - Characters stay 2D pixel-art billboard sprites (user decision
 *   2026-10-22) — nothing in this file assumes 3D character rigs.
 *
 * Simplified 2026-10-22 (user: "hanya room penting dan guna saja, tetap
 * 2 lantai"): only rooms that serve a real feature survived. Ground floor:
 * reception, open workspace (+Kanban screen, folded in from the cut PM
 * room), conference room, server room, pantry, restrooms, recovery room,
 * overflow hot desks (stress/spawn). Upper floor: musola, lounge & library,
 * one focus room, one content studio, and the upper corridor. Cut:
 * PM room, executive, R&D lab, focus room B, meeting pods, training,
 * terrace, and the decorative elevator shaft.
 */

export const FLOOR_HEIGHT = 3.5;
export const WALL_H = 3.2;
export const SLAB_T = 0.3;

export const BUILDING = {
  minX: -20,
  maxX: 20,
  minZ: -14,
  maxZ: 14,
} as const;

export type RoomType =
  | "reception"
  | "workspace"
  | "conference"
  | "server"
  | "pantry"
  | "restroom"
  | "recovery"
  | "studio"
  | "focus"
  | "lounge"
  | "musola"
  | "corridor"
  | "overflow";

export interface RoomDef {
  id: string;
  name: string;
  /** Floor index: 0 = ground, 1 = second. */
  floor: 0 | 1;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  type: RoomType;
  description: string;
  /** Camera-friendly anchor for "navigate to room". */
  anchor: [number, number, number];
}

const R = (
  id: string,
  name: string,
  floor: 0 | 1,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  type: RoomType,
  description: string,
): RoomDef => {
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const cy = floor === 0 ? 1.5 : FLOOR_HEIGHT + 1.5;
  return { id, name, floor, minX, maxX, minZ, maxZ, type, description, anchor: [cx, cy, cz] };
};

/**
 * All rooms. Ground floor (0): reception, open workspace, conference,
 * server, pantry, restrooms, recovery, overflow hot desks. Second floor
 * (1): musola, lounge & library, one focus room, one content studio, and
 * the upper corridor.
 */
export const ROOMS: RoomDef[] = [
  // ---- Ground floor ----
  R("reception", "Reception", 0, 8, 20, 8, 14, "reception",
    "Main entrance, welcome desk and waiting area."),
  R("openWorkspace", "Open Workspace", 0, -10, 10, -4, 7, "workspace",
    "Main desk block for the agent roster (ws-01..ws-08), with a live Kanban wall screen."),
  R("conferenceRoom", "Conference Room", 0, -20, -9, -14, -5, "conference",
    "Large meeting table, presentation display, glass walls."),
  R("serverRoom", "Server Room", 0, -8, -3, -14, -5, "server",
    "Racks, network gear and cooling. Restricted access."),
  R("restrooms", "Restrooms", 0, -2, 3, -14, -5, "restroom",
    "Separated restroom facilities."),
  R("pantry", "Pantry & Break Room", 0, 4, 10, -14, -5, "pantry",
    "Coffee machine, fridge, counter, dining table."),
  R("recoveryRoom", "Agent Recovery Room", 0, -20, -13, -4, 5, "recovery",
    "Quiet wellness room with recovery pods for errored agents."),
  R("overflow", "Overflow Hot Desks", 0, -19, -9, 6, 13, "overflow",
    "Extra workstations for stress-mode and spawned agents (stress-01..22)."),
  // ---- Second floor ----
  // North band (z -14..3.5): musola (west) + lounge (east), served by the
  // upper corridor (z 3.5..6). South band (z 6..14): focus room (west) +
  // content studio (east). The stair tower feeds the corridor's east end.
  R("musola", "Musola", 1, -20, -2, -14, 3.5, "musola",
    "Prayer room: rows of sajadah facing the qibla marker, shoe rack, wudu nook."),
  R("lounge", "Lounge & Library", 1, -2, 20, -14, 3.5, "lounge",
    "Bookshelves, sofas and plants. Idle agents relax here."),
  R("focus1", "Focus Room", 1, -20, -8, 6, 14, "focus",
    "Quiet enclosed room for uninterrupted work."),
  R("studio", "Content Studio", 1, -8, 20, 6, 14, "studio",
    "Writing, design and video-production workstations."),
  R("corridor", "Upper Corridor", 1, -20, 20, 3.5, 6, "corridor",
    "Connects the second-floor rooms to the stair tower."),
];

export const ROOM_BY_ID: Record<string, RoomDef> = Object.fromEntries(
  ROOMS.map((r) => [r.id, r]),
);

export function roomAt(x: number, z: number, floor: 0 | 1): RoomDef | null {
  for (const r of ROOMS) {
    if (r.floor !== floor) continue;
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return r;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Workstations
// ---------------------------------------------------------------------------

export interface WorkstationDef {
  id: string;
  roomId: string;
  floor: 0 | 1;
  position: [number, number, number];
  rotationY: number;
}

/** New workstations (the original ws-01..08 + stress desks live in layout.ts). */
const EXTRA_WORKSTATIONS: WorkstationDef[] = [
  // Content studio — two creative desks.
  { id: "studio-01", roomId: "studio", floor: 1, position: [2, FLOOR_HEIGHT, 10], rotationY: Math.PI },
  { id: "studio-02", roomId: "studio", floor: 1, position: [8, FLOOR_HEIGHT, 10], rotationY: Math.PI },
  // Focus room — one desk.
  { id: "focus-01", roomId: "focus1", floor: 1, position: [-14, FLOOR_HEIGHT, 10], rotationY: Math.PI / 2 },
];

export const WORKSTATIONS: Record<string, WorkstationDef> = Object.fromEntries(
  EXTRA_WORKSTATIONS.map((w) => [w.id, w]),
);

export function workstationFloor(id: string): 0 | 1 {
  return WORKSTATIONS[id]?.floor ?? 0;
}

// ---------------------------------------------------------------------------
// Recovery beds / pods
// ---------------------------------------------------------------------------

export interface BedDef {
  id: string;
  roomId: string;
  /** Bed center (floor plane); avatar stands/sits beside it. */
  position: [number, number, number];
  rotationY: number;
}

export const RECOVERY_BEDS: BedDef[] = [
  { id: "bed-01", roomId: "recoveryRoom", position: [-18.5, 0, -2.5], rotationY: Math.PI / 2 },
  { id: "bed-02", roomId: "recoveryRoom", position: [-18.5, 0, 0.5], rotationY: Math.PI / 2 },
  { id: "bed-03", roomId: "recoveryRoom", position: [-18.5, 0, 3.5], rotationY: Math.PI / 2 },
  { id: "bed-04", roomId: "recoveryRoom", position: [-14.5, 0, 3.5], rotationY: -Math.PI / 2 },
];

export const RECOVERY_ROOM_ID = "recoveryRoom";

// ---------------------------------------------------------------------------
// Stairs (elevator cut in the 2026-10-22 simplification: visual-only,
// pure decoration — agents always use the stair tower)
// ---------------------------------------------------------------------------

/**
 * Stair tower attached to the EAST facade (x 20..24, z -2..6), full height.
 * Agents enter at ground level through the east wall door (x=20, z≈2) and
 * exit upstairs into the upper corridor.
 */
export const STAIR_TOWER = {
  minX: 20,
  maxX: 24,
  minZ: -2,
  maxZ: 6,
  /** Waypoint chain with heights: base → mid-landing → top. */
  base: { x: 22, z: 2, y: 0 },
  mid: { x: 22, z: 2, y: FLOOR_HEIGHT / 2 },
  top: { x: 22, z: 2, y: FLOOR_HEIGHT },
  /** Door positions through the east wall. */
  groundDoor: { x: 20, z: 2 },
  upperDoor: { x: 20, z: 4.5 },
} as const;

// ---------------------------------------------------------------------------
// Camera presets
// ---------------------------------------------------------------------------

export type FloorMode = "entire" | "ground" | "second" | "outdoor";

export interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * Default camera per floor mode. `entire` is the dollhouse cutaway:
 * viewed from the south-east with roof + south walls hidden so both
 * floors read at once.
 */
export const CAMERA_PRESETS: Record<FloorMode, CameraPreset> = {
  entire: { position: [30, 19, 36], target: [0, 2.2, 0] },
  ground: { position: [17, 9, 21], target: [0, 1, 0] },
  second: { position: [17, 12.5, 21], target: [0, FLOOR_HEIGHT + 1, 0] },
  outdoor: { position: [-34, 13, 42], target: [2, 3, 0] },
};

/** Which building parts are visible per floor mode. */
export const FLOOR_VISIBILITY: Record<
  FloorMode,
  { ground: boolean; second: boolean; roof: boolean; cutSouthWalls: boolean }
> = {
  entire: { ground: true, second: true, roof: false, cutSouthWalls: true },
  ground: { ground: true, second: false, roof: false, cutSouthWalls: false },
  second: { ground: false, second: true, roof: false, cutSouthWalls: false },
  outdoor: { ground: true, second: true, roof: true, cutSouthWalls: false },
};
