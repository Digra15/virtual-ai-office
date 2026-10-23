/**
 * Data-driven floor plan for the single-floor Virtual AI Office.
 *
 * This file is the SINGLE SOURCE OF TRUTH for the building's spatial
 * design. Room components, the navigation graph, the occupancy store, the
 * camera presets, and the admin panel all read from here — never from
 * hardcoded coordinates scattered across components.
 *
 * Conventions:
 * - ONE floor only: y = 0 everywhere. (The two-story denah was dropped
 *   2026-10-23 per the user's redirect: single floor, faithful port of
 *   the user's own 10-room code.)
 * - Wall height: WALL_H. All room rects are in world units (x, z).
 * - Characters stay 2D pixel-art billboard sprites — nothing in this file
 *   assumes 3D character rigs.
 *
 * Layout (user's code, faithful):
 *
 *   North band (z -12..-4.5), doors open south into the corridor (z=-3):
 *     Musola | Ruang Recovery | Pantry | Toilet Pria | Toilet Wanita | Ruang Server
 *
 *   Mid / south:
 *     Ruang Project (west, x -16..-6.5, z 1..10; door on its east wall)
 *     Workspace     (center, x -6.5..9.5, z -4.5..6; open, no door)
 *     Resepsionis   (south, x -6.5..9.5, z 6..10; main entrance door)
 *     Ruang Meeting (east, x 9.5..16, z -1.8..10; door on its west wall)
 */

export const FLOOR_HEIGHT = 3.5; // kept for import compatibility (no second floor exists)
export const WALL_H = 3.2;
export const SLAB_T = 0.3;

export const BUILDING = {
  minX: -16,
  maxX: 16,
  minZ: -12,
  maxZ: 10,
} as const;

export type RoomType =
  | "reception"
  | "workspace"
  | "conference"
  | "server"
  | "pantry"
  | "restroom"
  | "recovery"
  | "project"
  | "musola";

export interface DoorDef {
  /** World position of the door opening. */
  x: number;
  z: number;
  /** Which wall of the room rect the opening is cut into. */
  wall: "north" | "south" | "east" | "west";
  /** Open archway (no door leaf), e.g. the pantry. */
  arch?: boolean;
}

export interface RoomDef {
  id: string;
  name: string;
  /** Floor index: 0 = ground. The building is single-floor; the type stays
   *  0|1 so shared/admin types keep compiling. */
  floor: 0 | 1;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  type: RoomType;
  description: string;
  /** Door opening, or null for open rooms (workspace). */
  door: DoorDef | null;
  /** Camera-friendly anchor for "navigate to room". */
  anchor: [number, number, number];
}

const R = (
  id: string,
  name: string,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  type: RoomType,
  door: DoorDef | null,
  description: string,
): RoomDef => {
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  return {
    id,
    name,
    floor: 0,
    minX,
    maxX,
    minZ,
    maxZ,
    type,
    door,
    description,
    anchor: [cx, 1.5, cz],
  };
};

/**
 * All 10 rooms, single floor (the user's coordinates, faithful):
 * north band = musola | recovery | pantry | toilet_pria | toilet_wanita |
 * server (doors south into the corridor); project (west, door east);
 * workspace (center, open); lobby/resepsionis (south, main entrance);
 * meeting (east, door west).
 */
export const ROOMS: RoomDef[] = [
  R("musola", "Musola", -16, -9, -12, -4.5, "musola",
    { x: -12.5, z: -4.5, wall: "south" },
    "Ruang salat: barisan sajadah, rak sepatu, dan tempat wudu."),
  R("recovery", "Ruang Recovery", -9, 0.5, -12, -4.5, "recovery",
    { x: -0.3, z: -4.5, wall: "south" },
    "Ruang tenang dengan pod pemulihan untuk agen yang error."),
  R("pantry", "Pantry", 0.5, 7.8, -12, -4.5, "pantry",
    { x: 1.8, z: -4.5, wall: "south", arch: true },
    "Dapur kecil: mesin kopi, kulkas, dan meja makan."),
  R("toilet_pria", "Toilet Pria", 7.8, 9.8, -12, -4.5, "restroom",
    { x: 8.8, z: -4.5, wall: "south" },
    "Fasilitas toilet pria."),
  R("toilet_wanita", "Toilet Wanita", 9.8, 11.8, -12, -4.5, "restroom",
    { x: 10.8, z: -4.5, wall: "south" },
    "Fasilitas toilet wanita."),
  R("server", "Ruang Server", 11.8, 16, -12, -4.5, "server",
    { x: 13.2, z: -4.5, wall: "south" },
    "Rak server, perangkat jaringan, dan pendingin. Akses terbatas."),
  R("project", "Ruang Project", -16, -6.5, 1, 10, "project",
    { x: -6.5, z: 3.0, wall: "east" },
    "Perencanaan proyek: papan Kanban LIVE dan meja diskusi."),
  R("workspace", "Workspace", -6.5, 9.5, -4.5, 6, "workspace",
    null,
    "Ruang kerja utama agen (ws-01..ws-08) plus hot-desk untuk spawned agents."),
  R("lobby", "Resepsionis", -6.5, 9.5, 6, 10, "reception",
    { x: 0, z: 10, wall: "south" },
    "Pintu masuk utama, meja resepsionis, dan ruang tunggu."),
  R("meeting", "Ruang Meeting", 9.5, 16, -1.8, 10, "conference",
    { x: 9.5, z: 2.0, wall: "west" },
    "Ruang rapat: meja besar, whiteboard, dan layar presentasi."),
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

/**
 * The 8 agent desks in the Workspace (the user's layout): two rows of
 * four — row 1 (ws-01..04) at z=-1.3, row 2 (ws-05..08) at z=+1.3, all
 * with rotationY 0 (desk opens south; the agent sits south of the desk at
 * z±0.68 and faces north toward the monitor — see facing.ts deskFacing =
 * deskRot + PI). Ids are stable: agent assignments depend on them.
 */
export const WORKSTATIONS: Record<string, WorkstationDef> = Object.fromEntries(
  [
    ["ws-01", -4, -1.3],
    ["ws-02", -2, -1.3],
    ["ws-03", 2, -1.3],
    ["ws-04", 4, -1.3],
    ["ws-05", -4, 1.3],
    ["ws-06", -2, 1.3],
    ["ws-07", 2, 1.3],
    ["ws-08", 4, 1.3],
  ].map(([id, x, z]) => [
    id,
    {
      id: id as string,
      roomId: "workspace",
      floor: 0 as const,
      position: [x as number, 0, z as number] as [number, number, number],
      rotationY: 0,
    },
  ]),
);

export function workstationFloor(id: string): 0 | 1 {
  return WORKSTATIONS[id]?.floor ?? 0;
}

// ---------------------------------------------------------------------------
// Recovery beds (ground floor — Ruang Recovery, west end of the north band)
// ---------------------------------------------------------------------------

export interface BedDef {
  id: string;
  roomId: string;
  /** Bed center (floor plane); avatar stands/sits beside it. */
  position: [number, number, number];
  rotationY: number;
}

export const RECOVERY_BEDS: BedDef[] = [
  { id: "bed-01", roomId: "recovery", position: [-7.3, 0, -10.8], rotationY: 0 },
  { id: "bed-02", roomId: "recovery", position: [-5.45, 0, -10.8], rotationY: 0 },
  { id: "bed-03", roomId: "recovery", position: [-3.6, 0, -10.8], rotationY: 0 },
  { id: "bed-04", roomId: "recovery", position: [-1.75, 0, -10.8], rotationY: 0 },
];

export const RECOVERY_ROOM_ID = "recovery";

// ---------------------------------------------------------------------------
// Camera presets (single floor)
// ---------------------------------------------------------------------------

/** Single floor: "office" (whole-building overview) or "outdoor". */
export type FloorMode = "office" | "outdoor";

export interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
}

export const CAMERA_PRESETS: Record<FloorMode, CameraPreset> = {
  office: { position: [18, 13, 22], target: [0, 1, -1] },
  outdoor: { position: [-26, 11, 32], target: [0, 2, -1] },
};

/**
 * Which building parts are visible per floor mode. Kept in the old shape
 * so Building.tsx (owned by the room-visual track) keeps compiling: the
 * second floor is always hidden in the single-floor plan.
 */
export const FLOOR_VISIBILITY: Record<
  FloorMode,
  { ground: boolean; second: boolean; roof: boolean; cutSouthWalls: boolean }
> = {
  office: { ground: true, second: false, roof: false, cutSouthWalls: false },
  outdoor: { ground: true, second: false, roof: true, cutSouthWalls: false },
};
