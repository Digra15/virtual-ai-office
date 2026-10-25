/**
 * Building composer (single floor): the shell — floor, outer + interior
 * walls, doorways, room plaques — plus the 10 room interiors and the
 * exterior, with visibility driven by the floor mode.
 *
 * The wall/door layout is a faithful port of the user's own builder code
 * (wall height 3.2, thickness 0.25, warm white #f5f1eb). Doorways are the
 * cozy `Doorway` primitive; door yaw follows the Doorway contract —
 * local +Z mounted pointing INTO the room — so leaves swing inward and
 * labels face the room.
 */
import { memo, useMemo } from "react";
import * as THREE from "three";
import { useBuildingViewStore } from "../../stores/useBuildingViewStore";
import { FLOOR_VISIBILITY, WALL_H } from "./floorPlan";
import { Exterior } from "../exterior/Exterior";
import { ROOM_COMPONENTS } from "./rooms";
import {
  Doorway,
  Plaque,
  useCozyTexture,
  DOORWAY_OPEN_ANGLE_DEFAULT,
  DOORWAY_POST,
  type DoorwayVariant,
} from "../cozy";
import { PolyModel } from "../PolyModel";
import { geoBox, geoPlane } from "../geometries";
import type { ComponentType } from "react";

// ---------------------------------------------------------------------------
// Shared materials (module-level: one instance per material, mesh-budget
// discipline — the black-viewport lesson).
// ---------------------------------------------------------------------------

const matWall = new THREE.MeshStandardMaterial({ color: "#f5f1eb", roughness: 0.92 });
const matGlassWall = new THREE.MeshStandardMaterial({
  color: "#cfe8f5",
  roughness: 0.08,
  metalness: 0.1,
  transparent: true,
  opacity: 0.35,
});
const matRoof = new THREE.MeshStandardMaterial({ color: "#d9d2c4", roughness: 0.95 });
const matSkirting = new THREE.MeshStandardMaterial({ color: "#7c5a36", roughness: 0.6 });
const matRunner = new THREE.MeshStandardMaterial({ color: "#b08968", roughness: 0.9 });
const matEntranceMat = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.95 });

// ---------------------------------------------------------------------------
// Wall segments — the user's layout, faithful.
// ---------------------------------------------------------------------------

export interface WallSeg {
  x: number;
  z: number;
  /** Length along the run axis. */
  length: number;
  axis: "x" | "z";
  height?: number;
  /** Glass panel above the wall, from `height` up to WALL_H. */
  glassAbove?: boolean;
}

/**
 * center-x/center-z, width — corridor-wall shorthand from the spec.
 * Wall-fit pass (2026-10-24): the gaps between these runs are EXACTLY
 * the door frames on this wall (1.15 wide, centered on each DOOR_SPECS
 * x). Spans are in the comments; the old layout had 1.05 gaps offset
 * from the doors, a 1.8-wide recovery gap, a 1.1 pantry gap offset by
 * 0.15, 0.1 sliver gaps, and a stray 1.05 hole at x≈-9 with no door
 * (no waypoint uses it — the corridor waypoints sit at the door
 * centers on z=-3.7 — so it is closed here, not preserved).
 */
const CORRIDOR: Array<[number, number, number?, boolean?]> = [
  // [centerX, width, height?, glassAbove?]
  [-14.5375, 2.925], // -16.0..-13.075
  [-10.2125, 3.425], // -11.925..-8.5 (gap -13.075..-11.925 = MUSOLA 1.15)
  [-5.0, 7.0, 1.1, true], // -8.5..-1.5, UNCHANGED low+glass
  [-1.1875, 0.625], // -1.5..-0.875
  [0.75, 0.95], // 0.275..1.225 (gap -0.875..0.275 = RECOVERY 1.15)
  [5.3, 5.85], // 2.375..8.225 (gap 1.225..2.375 = PANTRY 1.15)
  [9.8, 0.85], // 9.375..10.225 (gap 8.225..9.375 = TOILET PRIA 1.15)
  [12.0, 1.25], // 11.375..12.625 (gap 10.225..11.375 = TOILET WANITA 1.15)
  [13.9375, 0.325], // 13.775..14.1 (gap 12.625..13.775 = SERVER 1.15)
  [15.0, 1.8, 1.1, true], // 14.1..15.9, UNCHANGED low+glass (east outer wall covers 15.875..)
];

export const WALL_SEGMENTS: WallSeg[] = [
  // outer shell
  { x: 0, z: -12, length: 32, axis: "x" }, // north
  { x: -16, z: -1, length: 22, axis: "z" }, // west
  { x: 16, z: -1, length: 22, axis: "z" }, // east
  { x: -8.55, z: 10, length: 14.9, axis: "x", height: 1.1 }, // front low -16..-1.1 (entrance gap -1.1..1.1 = 2.2)
  { x: 8.55, z: 10, length: 14.9, axis: "x", height: 1.1 }, // front low 1.1..16, height stays 1.1 for camera visibility
  // north-band dividers (z -12..-4.5)
  ...[-9.0, 0.5, 7.8, 9.8, 11.8].map(
    (x): WallSeg => ({ x, z: -8.25, length: 7.5, axis: "z" }),
  ),
  // corridor wall (z=-4.5)
  ...CORRIDOR.map(
    ([cx, w, h, glass]): WallSeg => ({
      x: cx,
      z: -4.5,
      length: w,
      axis: "x",
      height: h,
      glassAbove: glass,
    }),
  ),
  // project room: north wall + east wall (door gap z 2.425..3.575 = 1.15, centered 3.0)
  { x: -11.25, z: 1.0, length: 9.5, axis: "x" },
  { x: -6.5, z: 1.7125, length: 1.425, axis: "z" }, // 1.0..2.425
  { x: -6.5, z: 6.7875, length: 6.425, axis: "z" }, // 3.575..10.0
  // meeting room: north wall + west wall (h1.2 + glass, door gap z 1.425..2.575 = 1.15, centered 2.0)
  { x: 12.75, z: -1.8, length: 6.5, axis: "x" },
  { x: 9.5, z: -0.1875, length: 3.225, axis: "z", height: 1.2, glassAbove: true }, // -1.8..1.425
  { x: 9.5, z: 6.2875, length: 7.425, axis: "z", height: 1.2, glassAbove: true }, // 2.575..10.0
];

/** One solid wall run: box [length|0.25, height, 0.25|length], plus
 * dark-wood skirting boards on both faces (the "proper office" trim). */
const WallRun = memo(function WallRun({ x, z, length, axis, height = WALL_H, glassAbove }: WallSeg) {
  const h = height;
  const trimPos = (offset: number): [number, number, number] =>
    axis === "x" ? [x, 0.06, z + offset] : [x + offset, 0.06, z];
  const trimScale: [number, number, number] =
    axis === "x" ? [length, 0.12, 0.03] : [0.03, 0.12, length];
  return (
    <group>
      <mesh
        geometry={geoBox}
        material={matWall}
        scale={axis === "x" ? [length, h, 0.25] : [0.25, h, length]}
        position={[x, h / 2, z]}
        castShadow
        receiveShadow
      />
      {/* skirting on both faces */}
      <mesh geometry={geoBox} material={matSkirting} scale={trimScale} position={trimPos(0.14)} />
      <mesh geometry={geoBox} material={matSkirting} scale={trimScale} position={trimPos(-0.14)} />
      {glassAbove && (
        <mesh
          geometry={geoBox}
          material={matGlassWall}
          scale={axis === "x" ? [length, WALL_H - h, 0.12] : [0.12, WALL_H - h, length]}
          position={[x, h + (WALL_H - h) / 2, z]}
        />
      )}
    </group>
  );
});

// ---------------------------------------------------------------------------
// Doors — the user's placements. Yaw follows the Doorway contract:
// local +Z points INTO the room.
// ---------------------------------------------------------------------------

export interface DoorSpec {
  position: [number, number, number];
  /** Yaw so that Doorway local +Z faces into the room. */
  yaw: number;
  variant: DoorwayVariant;
  label?: string;
  width?: number;
  height?: number;
  /** Hide the procedural leaves: a real GLB leaf is rendered instead. */
  hideLeaves?: boolean;
}

export const DOOR_SPECS: DoorSpec[] = [
  { position: [0, 0, 10], yaw: Math.PI, variant: "double_glass", label: "ENTRANCE", width: 2.2, height: 2.7, hideLeaves: true },
  { position: [-12.5, 0, -4.5], yaw: Math.PI, variant: "wood", label: "MUSOLA", hideLeaves: true },
  { position: [-0.3, 0, -4.5], yaw: Math.PI, variant: "hospital", label: "RECOVERY" },
  { position: [1.8, 0, -4.5], yaw: Math.PI, variant: "open_arch", label: "PANTRY" },
  { position: [8.8, 0, -4.5], yaw: Math.PI, variant: "restroom_m" },
  { position: [10.8, 0, -4.5], yaw: Math.PI, variant: "restroom_f" },
  { position: [13.2, 0, -4.5], yaw: Math.PI, variant: "security", label: "SERVER" },
  { position: [-6.5, 0, 3.0], yaw: -Math.PI / 2, variant: "wood", label: "PROJECT", hideLeaves: true },
  { position: [9.5, 0, 2.0], yaw: Math.PI / 2, variant: "glass", label: "MEETING" },
];

// ---------------------------------------------------------------------------
// Real GLB door leaves (user-supplied poly.pizza files). The procedural
// frame, header, threshold and label stay; only the leaves are replaced,
// hinged and swung exactly like the procedural Leaf they replace.
// ---------------------------------------------------------------------------

/** Entrance: two french-door leaves (raw 0.36 wide x 0.86 tall). */
const FRENCH_LEAF_SCALE = 2.64 / 0.86; // target leaf height / raw height
const FRENCH_LEAF_WIDTH = 0.36 * FRENCH_LEAF_SCALE; // 1.105
const ENTRANCE_POST_X = 2.2 / 2 - DOORWAY_POST / 2; // 1.06

const FrenchDoorPair = memo(function FrenchDoorPair() {
  const open = DOORWAY_OPEN_ANGLE_DEFAULT * 0.7; // same factor as doubleLeaf
  return (
    <group position={[0, 0, 10]} rotation={[0, Math.PI, 0]}>
      <group position={[-ENTRANCE_POST_X, 0, 0]} rotation={[0, -open, 0]}>
        <group position={[FRENCH_LEAF_WIDTH / 2, 0, 0]}>
          <PolyModel file="french-door.glb" position={[0, 0, 0]} scale={FRENCH_LEAF_SCALE} />
        </group>
      </group>
      <group position={[ENTRANCE_POST_X, 0, 0]} rotation={[0, open, 0]}>
        <group position={[-FRENCH_LEAF_WIDTH / 2, 0, 0]}>
          <PolyModel file="french-door.glb" position={[0, 0, 0]} scale={FRENCH_LEAF_SCALE} />
        </group>
      </group>
    </group>
  );
});

/**
 * Wood doors (MUSOLA, PROJECT): the leaf of the converted Door_and_frame
 * GLB (nodes Door2 + Glass2 + Glass16, raw 162.5 wide x 325 tall; frame
 * nodes Door_frame + Glass hidden — the procedural frame stays).
 */
const WOOD_LEAF_HIDDEN = ["Door_frame", "Glass"] as const;
const WOOD_LEAF_SCALE = 2.09 / 325; // default doorway leaf height / raw leaf height
const WOOD_LEAF_WIDTH = 162.5 * WOOD_LEAF_SCALE; // 1.045
const WOOD_POST_X = 1.15 / 2 - DOORWAY_POST / 2; // 0.535 (default width)

const WoodDoorLeaf = memo(function WoodDoorLeaf({ spec }: { spec: DoorSpec }) {
  return (
    <group position={spec.position} rotation={[0, spec.yaw, 0]}>
      <group position={[-WOOD_POST_X, 0, 0]} rotation={[0, -DOORWAY_OPEN_ANGLE_DEFAULT, 0]}>
        <group position={[WOOD_LEAF_WIDTH / 2, 0, 0]}>
          <PolyModel file="door-and-frame.glb" position={[0, 0, 0]} scale={WOOD_LEAF_SCALE} hideNodes={WOOD_LEAF_HIDDEN} />
        </group>
      </group>
    </group>
  );
});

// ---------------------------------------------------------------------------
// Room plaques — mounted on the nearest wall face, never floating.
// ---------------------------------------------------------------------------

export interface PlaqueSpec {
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
  position: [number, number, number];
  rotationY: number;
  /** Card width in meters (height is width/2). Sized per wall below. */
  width: number;
}

/**
 * Plaque fit pass (2026-10-25): every plaque's width + center is sized
 * to the wall segment it hangs on, and its vertical span fits the
 * SOLID part of that wall (low walls are 1.1/1.2 + glass above, so
 * plaques there are smaller and lower). The previous 1.7 m default
 * overflowed two segments badly: Toilet hung over BOTH toilet door
 * gaps (segment only 0.85 wide) and Server crossed the server door gap
 * (segment 1.25 wide, plaque centered off-segment); Resepsionis poked
 * 0.025 above the 1.1 front wall, and Recovery/Meeting nearly touched
 * the glass above their 1.1/1.2 walls. Text fit is handled in
 * drawPlaqueCard (auto-fit, no truncation).
 */
export const PLAQUE_SPECS: PlaqueSpec[] = [
  // front low wall (solid 1.1): 1.5 wide, 0.175..0.925
  { title: "Resepsionis", subtitle: "Penerima Tamu", icon: "👤", accent: "#ff6b9d", position: [-3.0, 0.55, 9.87], rotationY: Math.PI, width: 1.5 },
  // project/workspace divider (full height, door gap ends z 3.575): clear of the gap
  { title: "Workspace Agent", subtitle: "Area Kerja Utama", icon: "💻", accent: "#0284c7", position: [-6.37, 1.9, 5.0], rotationY: Math.PI / 2, width: 1.7 },
  { title: "Ruang Project (DIFIA)", subtitle: "Manajemen Tugas", icon: "📁", accent: "#ea580c", position: [-6.63, 1.9, 5.0], rotationY: -Math.PI / 2, width: 1.7 },
  // corridor full-height segment -11.925..-8.5: unchanged, already fit
  { title: "Musola", subtitle: "Ibadah", icon: "🕌", accent: "#16a34a", position: [-10.5, 1.9, -4.37], rotationY: 0, width: 1.7 },
  // corridor low+glass segment -8.5..-1.5 (solid 1.1): 1.4 wide, 0.2..0.9
  { title: "Ruang Recovery", subtitle: "Agent Error / Istirahat", icon: "🛏️", accent: "#ec4899", position: [-2.8, 0.55, -4.37], rotationY: 0, width: 1.4 },
  // corridor full-height segment 2.375..8.225: unchanged, already fit
  { title: "Pantry", subtitle: "Makan & Istirahat", icon: "☕", accent: "#ca8a04", position: [4.2, 1.9, -4.37], rotationY: 0, width: 1.7 },
  // corridor segment between the two toilet doors, 9.375..10.225 (0.85): 0.75 wide, centered
  { title: "Toilet", subtitle: "Pria & Wanita", icon: "🚻", accent: "#7c3aed", position: [9.8, 1.9, -4.37], rotationY: 0, width: 0.75 },
  // corridor segment 11.375..12.625 (1.25): 1.15 wide, centered on the segment
  { title: "Ruang Server", subtitle: "Infrastruktur", icon: "🗄️", accent: "#4338ca", position: [12.0, 1.9, -4.37], rotationY: 0, width: 1.15 },
  // meeting west wall, low 1.2 + glass (segment 2.575..10.0): 1.4 wide, 0.2..0.9
  { title: "Ruang Meeting", subtitle: "Diskusi & Presentasi", icon: "👥", accent: "#e11d48", position: [9.63, 0.55, 5.0], rotationY: Math.PI / 2, width: 1.4 },
];

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

export const Building = memo(function Building() {
  const floorMode = useBuildingViewStore((s) => s.floorMode);
  const v = FLOOR_VISIBILITY[floorMode];

  const tile = useCozyTexture("tile", {
    colorA: "#f7f0e6",
    colorB: "#ebd8c5",
    repeat: [14, 10],
  });

  // ROOM_COMPONENTS maps both toilet ids to one Restrooms component —
  // mount each component once.
  const roomEntries = useMemo(() => {
    const seen = new Set<ComponentType>();
    const out: Array<[string, ComponentType]> = [];
    for (const id of Object.keys(ROOM_COMPONENTS)) {
      const C = ROOM_COMPONENTS[id];
      if (!seen.has(C)) {
        seen.add(C);
        out.push([id, C]);
      }
    }
    return out;
  }, []);

  return (
    <group>
      {/* marble-tile floor: 32×22 plane at (0,0,-1) */}
      <mesh geometry={geoPlane} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1]} receiveShadow>
        <meshStandardMaterial map={tile} roughness={0.5} metalness={0.05} />
      </mesh>

      {/* walls + glass panels */}
      <group visible={v.ground}>
        {WALL_SEGMENTS.map((s, i) => (
          <WallRun key={i} {...s} />
        ))}
        {/* corridor runner rug along the north walkway (split around
            the planter strips at x=±5.8 so it never clips through them) */}
        {[
          { x: -10, len: 8 },
          { x: 0, len: 11 },
          { x: 10, len: 8 },
        ].map((s, i) => (
          <mesh
            key={i}
            geometry={geoPlane}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[s.x, 0.012, -3.7]}
            scale={[s.len, 1.1, 1]}
          >
            <meshStandardMaterial color={matRunner.color} roughness={0.9} />
          </mesh>
        ))}
        {/* entrance mat just inside the double-glass doors */}
        <mesh geometry={geoPlane} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 9.2]} scale={[2.6, 1.2, 1]}>
          <meshStandardMaterial color={matEntranceMat.color} roughness={0.95} />
        </mesh>
        {/* doors */}
        {DOOR_SPECS.map((d, i) => (
          <Doorway
            key={i}
            position={d.position}
            rotationY={d.yaw}
            variant={d.variant}
            label={d.label}
            width={d.width}
            height={d.height}
            hideLeaves={d.hideLeaves}
          />
        ))}
        {/* real GLB leaves replacing the hidden procedural ones */}
        <FrenchDoorPair />
        {DOOR_SPECS.filter((d) => d.variant === "wood").map((d, i) => (
          <WoodDoorLeaf key={i} spec={d} />
        ))}
        {/* room plaques */}
        {PLAQUE_SPECS.map((p, i) => (
          <Plaque
            key={i}
            title={p.title}
            subtitle={p.subtitle}
            icon={p.icon}
            accent={p.accent}
            position={p.position}
            rotationY={p.rotationY}
            width={p.width}
          />
        ))}
        {/* room interiors */}
        {roomEntries.map(([id, C]) => (
          <C key={id} />
        ))}
      </group>

      {/* roof slab: only in outdoor mode */}
      {v.roof && (
        <mesh geometry={geoBox} material={matRoof} scale={[32.6, 0.25, 22.6]} position={[0, WALL_H + 0.125, -1]} castShadow />
      )}

      <Exterior />
    </group>
  );
});
