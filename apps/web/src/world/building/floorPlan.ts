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
 *   working; new workstations get ids like `konten-01`, `focus-01`.
 * - Characters stay 2D pixel-art billboard sprites (user decision
 *   2026-10-22) — nothing in this file assumes 3D character rigs.
 *
 * Redesigned 2026-10-22 from the user's dream-office reference
 * ("DENAH LANTAI 1 / 2"):
 *
 *   LANTAI 1 — Operasional & Kolaborasi (top edge -> bottom edge):
 *     top row:    Ruang Meeting | Ruang Server | Pantry | Toilet
 *     mid-left:   Ruang Project (live Kanban / task-management screens)
 *     center:     Workspace (ws-01..ws-08 + hot-desk bullpen annex)
 *     bottom-left: Resepsionis (main entrance "Pintu Masuk")
 *     right side: stair tower + open stair lobby (no room — circulation)
 *
 *   LANTAI 2 — Strategi & Pengembangan:
 *     top row:      Ruang Direksi | Ruang Konten | Musola
 *     mid-left:     Ruang Fokus
 *     center:       Lounge (idle agents wander here)
 *     bottom-left:  Ruang Pemulihan (recovery beds — moved up from L1)
 *     bottom-right: Ruang R&D (experiment / dev desks)
 *     right side:   stair landing + lobby (no room — circulation)
 *
 * Areas with no RoomDef (stair lobbies, the garden hall) are dressed by
 * rooms/Circulation.tsx — they are walkable circulation, not rooms.
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
  | "project"
  | "direksi"
  | "konten"
  | "rnd"
  | "focus"
  | "lounge"
  | "musola";

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
 * All 14 rooms. Ground floor (0): meeting, server, pantry, restroom
 * (north band), project (mid-left), workspace (center, incl. the hot-desk
 * bullpen annex), reception (bottom-left, main entrance). Second floor
 * (1): direksi, konten, musola (north band), fokus (mid-left), lounge
 * (center), pemulihan (bottom-left), rnd (bottom-right).
 */
export const ROOMS: RoomDef[] = [
  // ---- Ground floor: Operasional & Kolaborasi ----
  R("meeting", "Ruang Meeting", 0, -20, -11, -14, -5, "conference",
    "Ruang rapat: meja besar, whiteboard, dan layar presentasi."),
  R("server", "Ruang Server", 0, -11, -2, -14, -5, "server",
    "Rak server, perangkat jaringan, dan pendingin. Akses terbatas."),
  R("pantry", "Pantry", 0, -2, 6, -14, -5, "pantry",
    "Dapur kecil: mesin kopi, kulkas, dan meja makan."),
  R("restroom", "Toilet", 0, 6, 13, -14, -5, "restroom",
    "Fasilitas toilet."),
  R("project", "Ruang Project", 0, -20, -10, -5, 6, "project",
    "Perencanaan proyek: papan Kanban LIVE dan meja diskusi."),
  R("openWorkspace", "Workspace", 0, -10, 10, -5, 14, "workspace",
    "Ruang kerja utama agen (ws-01..ws-08) plus hot-desk untuk spawned agents."),
  R("reception", "Resepsionis", 0, -20, -10, 6, 14, "reception",
    "Pintu masuk utama, meja resepsionis, dan ruang tunggu."),
  // ---- Second floor: Strategi & Pengembangan ----
  R("direksi", "Ruang Direksi", 1, -20, -9, -14, -4, "direksi",
    "Ruang direktur: meja kerja dan layar strategi/analitik."),
  R("konten", "Ruang Konten", 1, -9, 2, -14, -4, "konten",
    "Studio konten: meja kreator untuk writing, desain, dan video."),
  R("musola", "Musola", 1, 2, 13, -14, -4, "musola",
    "Ruang salat: barisan sajadah menghadap penanda kiblat, rak sepatu, tempat wudu."),
  R("fokus", "Ruang Fokus", 1, -20, -12, -4, 5, "focus",
    "Ruang kerja individual yang tenang."),
  R("lounge", "Lounge", 1, -12, 6, -4, 5, "lounge",
    "Sofa, tanaman, dan area diskusi santai. Agen idle bersantai di sini."),
  R("pemulihan", "Ruang Pemulihan", 1, -20, -9, 5, 14, "recovery",
    "Ruang tenang dengan pod pemulihan untuk agen yang error."),
  R("rnd", "Ruang R&D", 1, 1, 16, 5, 14, "rnd",
    "Ruang riset & pengembangan: meja eksperimen dan multi-monitor."),
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

/** New workstations (the original ws-01..ws-08 + stress desks live in layout.ts). */
const EXTRA_WORKSTATIONS: WorkstationDef[] = [
  // Ruang Konten — two creator desks.
  { id: "konten-01", roomId: "konten", floor: 1, position: [-5.5, FLOOR_HEIGHT, -9], rotationY: Math.PI },
  { id: "konten-02", roomId: "konten", floor: 1, position: [-0.5, FLOOR_HEIGHT, -9], rotationY: Math.PI },
  // Ruang Fokus — one desk.
  { id: "focus-01", roomId: "fokus", floor: 1, position: [-16, FLOOR_HEIGHT, 0], rotationY: Math.PI / 2 },
];

export const WORKSTATIONS: Record<string, WorkstationDef> = Object.fromEntries(
  EXTRA_WORKSTATIONS.map((w) => [w.id, w]),
);

export function workstationFloor(id: string): 0 | 1 {
  return WORKSTATIONS[id]?.floor ?? 0;
}

// ---------------------------------------------------------------------------
// Recovery beds / pods (second floor — Ruang Pemulihan)
// ---------------------------------------------------------------------------

export interface BedDef {
  id: string;
  roomId: string;
  /** Bed center (floor plane); avatar stands/sits beside it. */
  position: [number, number, number];
  rotationY: number;
}

export const RECOVERY_BEDS: BedDef[] = [
  { id: "bed-01", roomId: "pemulihan", position: [-18.5, 0, 7], rotationY: Math.PI / 2 },
  { id: "bed-02", roomId: "pemulihan", position: [-18.5, 0, 9.5], rotationY: Math.PI / 2 },
  { id: "bed-03", roomId: "pemulihan", position: [-18.5, 0, 12], rotationY: Math.PI / 2 },
  { id: "bed-04", roomId: "pemulihan", position: [-15.5, 0, 12], rotationY: -Math.PI / 2 },
];

export const RECOVERY_ROOM_ID = "pemulihan";

// ---------------------------------------------------------------------------
// Stairs (right / east side of the building, per the reference denah).
// Visual-only tower — agents always use the stair chain below.
// ---------------------------------------------------------------------------

/**
 * Stair tower attached to the EAST facade (x 20..24, z -2..6), full height.
 * Agents enter at ground level through the east wall door (x=20, z≈2) and
 * exit upstairs into the upper stair lobby.
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
