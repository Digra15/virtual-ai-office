/**
 * Fallback components + shared materials for the room interiors.
 *
 * HISTORY: the sibling-owned furniture modules (world/furniture/Bed,
 * Bookshelf, ReceptionCounter, KitchenSet, DiningSet, RestroomSet, Railing,
 * Door, Signage) and world/building/BuildingShell + world/exterior/Exterior
 * did not exist when the rooms were first built, so these stand-ins were
 * used. The real modules have since landed and every room now imports them
 * directly; the Fallback* components below are retained only as a documented
 * backup of the assumed prop APIs.
 *
 * Still actively used: matPanelDark / matGlowTeal / matGlowWarm (shared
 * display-board materials).
 *
 * Assumed prop APIs (kept for reference):
 *   Bed/Bookshelf/ReceptionCounter/KitchenSet/Fridge/DiningSet:
 *     { position?: [x,y,z]; rotationY?: number }
 *   CoffeeMachine: { position?: [x,y,z]; rotationY?: number }
 *     — countertop unit, base sits at local y=0 (place at counter-top height).
 *   RestroomSet: { position?: [x,y,z]; rotationY?: number }
 *     — anchor at local origin; fixtures span local x 0..4.4, z 0..1.7.
 *   Railing: { length: number; position?: [x,y,z]; rotationY?: number }
 *   Door: { position?: [x,y,z]; rotationY?: number; glass?: boolean; width?: number }
 *   Signage: { text: string; position?: [x,y,z]; rotationY?: number;
 *              width?: number; accent?: string }
 *     — wall-mounted backlit panel; text faces local +z.
 */
import { memo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import {
  geoBox,
  geoCone,
  geoCylinder,
  geoPlane,
  geoSphere,
} from "../../geometries";
import {
  matBookAmber,
  matBookBlue,
  matBookGreen,
  matBookRed,
  matDeskLeg,
  matFloor,
  matGlass,
  matWall,
} from "../../materials";
import { Wall } from "../../furniture/Wall";
import { BUILDING, FLOOR_HEIGHT, WALL_H } from "../floorPlan";

// ---------------------------------------------------------------------------
// Shared fallback materials
// ---------------------------------------------------------------------------

const matWood = new THREE.MeshStandardMaterial({ color: "#8a5a33", roughness: 0.7 });
const matWoodDark = new THREE.MeshStandardMaterial({ color: "#5d3d22", roughness: 0.75 });
const matFabric = new THREE.MeshStandardMaterial({ color: "#e8e0d2", roughness: 0.9 });
const matDark = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.5, metalness: 0.35 });
const matSteel = new THREE.MeshStandardMaterial({ color: "#9ca3af", roughness: 0.35, metalness: 0.7 });
const matTrunk = new THREE.MeshStandardMaterial({ color: "#5b3a1e", roughness: 0.9 });
const matLeaf = new THREE.MeshStandardMaterial({ color: "#2f7a3d", roughness: 0.9 });
const matGrass = new THREE.MeshStandardMaterial({ color: "#3d6b23", roughness: 1 });
const matWalk = new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.95 });

/** Dark screen panel + glow colors shared by the rooms' display boards. */
export const matPanelDark = new THREE.MeshStandardMaterial({ color: "#0b1220", roughness: 0.5 });
export const matGlowTeal = new THREE.MeshStandardMaterial({
  color: "#0f766e",
  emissive: "#2dd4bf",
  emissiveIntensity: 1.6,
});
export const matGlowWarm = new THREE.MeshStandardMaterial({
  color: "#92400e",
  emissive: "#fbbf24",
  emissiveIntensity: 1.8,
});

type V3 = [number, number, number];

interface PlacedProps {
  position?: V3;
  rotationY?: number;
}

// ---------------------------------------------------------------------------
// Signage — backlit wall panel with text
// ---------------------------------------------------------------------------

interface FallbackSignageProps extends PlacedProps {
  text: string;
  width?: number;
  accent?: string;
}

export const FallbackSignage = memo(function FallbackSignage({
  text,
  position = [0, 0, 0],
  rotationY = 0,
  width = 3,
  accent = "#38bdf8",
}: FallbackSignageProps) {
  // Shrink the font so long labels fit the panel.
  const fontSize = Math.min(0.34, (width - 0.4) / Math.max(1, text.length * 0.58));
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matDark} scale={[width, 0.7, 0.08]} position={[0, 2.3, 0]} castShadow />
      <mesh geometry={geoBox} material={matGlowTeal} scale={[width, 0.05, 0.085]} position={[0, 1.93, 0]} />
      <Text
        position={[0, 2.3, 0.055]}
        fontSize={fontSize}
        color={accent}
        anchorX="center"
        anchorY="middle"
        maxWidth={width - 0.3}
      >
        {text}
      </Text>
    </group>
  );
});

// ---------------------------------------------------------------------------
// Bed — recovery pod (warm wood, not clinical)
// ---------------------------------------------------------------------------

export const FallbackBed = memo(function FallbackBed({
  position = [0, 0, 0],
  rotationY = 0,
}: PlacedProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matWood} scale={[2.2, 0.32, 1.0]} position={[0, 0.28, 0]} castShadow />
      <mesh geometry={geoBox} material={matWoodDark} scale={[0.1, 1.0, 1.0]} position={[-1.1, 0.5, 0]} castShadow />
      <mesh geometry={geoBox} material={matFabric} scale={[2.05, 0.22, 0.92]} position={[0.02, 0.55, 0]} castShadow />
      <mesh geometry={geoBox} material={matGlowTeal} scale={[1.0, 0.1, 0.94]} position={[0.5, 0.68, 0]} />
      <mesh geometry={geoBox} material={matFabric} scale={[0.55, 0.14, 0.7]} position={[-0.7, 0.72, 0]} castShadow />
      {[-0.95, 0.95].map((x) =>
        [-0.4, 0.4].map((z) => (
          <mesh
            key={`${x}:${z}`}
            geometry={geoBox}
            material={matWoodDark}
            scale={[0.1, 0.14, 0.1]}
            position={[x, 0.07, z]}
          />
        )),
      )}
    </group>
  );
});

// ---------------------------------------------------------------------------
// Bookshelf
// ---------------------------------------------------------------------------

const BOOK_MATS = [matBookRed, matBookBlue, matBookGreen, matBookAmber];

export const FallbackBookshelf = memo(function FallbackBookshelf({
  position = [0, 0, 0],
  rotationY = 0,
}: PlacedProps) {
  const shelves = [0.35, 0.85, 1.35, 1.8];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matWoodDark} scale={[0.08, 2.0, 0.35]} position={[-0.86, 1.0, 0]} castShadow />
      <mesh geometry={geoBox} material={matWoodDark} scale={[0.08, 2.0, 0.35]} position={[0.86, 1.0, 0]} castShadow />
      <mesh geometry={geoBox} material={matWoodDark} scale={[1.8, 2.0, 0.05]} position={[0, 1.0, -0.15]} />
      <mesh geometry={geoBox} material={matWoodDark} scale={[1.8, 0.08, 0.35]} position={[0, 0.04, 0]} />
      <mesh geometry={geoBox} material={matWoodDark} scale={[1.8, 0.08, 0.35]} position={[0, 1.98, 0]} />
      {shelves.map((y) => (
        <mesh key={y} geometry={geoBox} material={matWood} scale={[1.64, 0.05, 0.32]} position={[0, y, 0]} />
      ))}
      {shelves.map((y, si) =>
        Array.from({ length: 9 }, (_, i) => {
          const h = 0.28 + ((i * 7 + si * 3) % 5) * 0.03;
          return (
            <mesh
              key={`${si}:${i}`}
              geometry={geoBox}
              material={BOOK_MATS[(i + si) % BOOK_MATS.length]}
              scale={[0.13, h, 0.24]}
              position={[-0.72 + i * 0.165, y + 0.025 + h / 2, 0.02]}
            />
          );
        }),
      )}
    </group>
  );
});

// ---------------------------------------------------------------------------
// ReceptionCounter
// ---------------------------------------------------------------------------

export const FallbackReceptionCounter = memo(function FallbackReceptionCounter({
  position = [0, 0, 0],
  rotationY = 0,
}: PlacedProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matWood} scale={[3.4, 1.0, 0.7]} position={[0, 0.5, 0]} castShadow receiveShadow />
      <mesh geometry={geoBox} material={matDark} scale={[3.0, 0.6, 0.04]} position={[0, 0.5, 0.36]} />
      <mesh geometry={geoBox} material={matGlowTeal} scale={[3.0, 0.06, 0.045]} position={[0, 0.86, 0.36]} />
      <mesh geometry={geoBox} material={matWoodDark} scale={[3.6, 0.07, 0.95]} position={[0, 1.03, 0]} castShadow />
    </group>
  );
});

// ---------------------------------------------------------------------------
// KitchenSet — counter run with sink + faucet
// ---------------------------------------------------------------------------

export const FallbackKitchenSet = memo(function FallbackKitchenSet({
  position = [0, 0, 0],
  rotationY = 0,
}: PlacedProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matWoodDark} scale={[3.6, 0.85, 0.65]} position={[0, 0.425, 0]} castShadow />
      {[-1.35, -0.45, 0.45, 1.35].map((x) => (
        <mesh key={x} geometry={geoBox} material={matDark} scale={[0.04, 0.6, 0.02]} position={[x, 0.42, 0.33]} />
      ))}
      <mesh geometry={geoBox} material={matSteel} scale={[3.7, 0.06, 0.7]} position={[0, 0.88, 0]} castShadow />
      {/* sink */}
      <mesh geometry={geoBox} material={matDark} scale={[0.7, 0.12, 0.45]} position={[-0.8, 0.9, 0]} />
      <mesh geometry={geoCylinder} material={matSteel} scale={[0.06, 0.35, 0.06]} position={[-0.8, 1.05, -0.18]} />
      <mesh geometry={geoBox} material={matSteel} scale={[0.06, 0.06, 0.3]} position={[-0.8, 1.2, -0.05]} />
    </group>
  );
});

// ---------------------------------------------------------------------------
// CoffeeMachine — countertop unit (base at local y=0)
// ---------------------------------------------------------------------------

export const FallbackCoffeeMachine = memo(function FallbackCoffeeMachine({
  position = [0, 0, 0],
  rotationY = 0,
}: PlacedProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matDark} scale={[0.55, 0.5, 0.45]} position={[0, 0.25, 0]} castShadow />
      <mesh geometry={geoBox} material={matSteel} scale={[0.4, 0.3, 0.04]} position={[0, 0.28, 0.22]} />
      <mesh geometry={geoBox} material={matGlowWarm} scale={[0.3, 0.04, 0.05]} position={[0, 0.42, 0.22]} />
      <mesh geometry={geoCylinder} material={matSteel} scale={[0.3, 0.04, 0.3]} position={[0, 0.03, 0.1]} />
    </group>
  );
});

// ---------------------------------------------------------------------------
// Fridge
// ---------------------------------------------------------------------------

export const FallbackFridge = memo(function FallbackFridge({
  position = [0, 0, 0],
  rotationY = 0,
}: PlacedProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matSteel} scale={[0.85, 1.9, 0.7]} position={[0, 0.95, 0]} castShadow />
      <mesh geometry={geoBox} material={matDark} scale={[0.8, 0.03, 0.02]} position={[0, 1.25, 0.36]} />
      <mesh geometry={geoBox} material={matDark} scale={[0.04, 0.35, 0.04]} position={[-0.25, 1.0, 0.38]} />
      <mesh geometry={geoBox} material={matDark} scale={[0.04, 0.5, 0.04]} position={[0.25, 0.85, 0.38]} />
    </group>
  );
});

// ---------------------------------------------------------------------------
// DiningSet — round table + 4 stools
// ---------------------------------------------------------------------------

export const FallbackDiningSet = memo(function FallbackDiningSet({
  position = [0, 0, 0],
  rotationY = 0,
}: PlacedProps) {
  const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoCylinder} material={matWood} scale={[1.5, 0.07, 1.5]} position={[0, 0.73, 0]} castShadow />
      <mesh geometry={geoCylinder} material={matWoodDark} scale={[0.14, 0.7, 0.14]} position={[0, 0.36, 0]} />
      <mesh geometry={geoCylinder} material={matWoodDark} scale={[0.7, 0.06, 0.7]} position={[0, 0.03, 0]} />
      {angles.map((a) => (
        <group key={a} rotation={[0, a, 0]}>
          <mesh geometry={geoCylinder} material={matWood} scale={[0.55, 0.08, 0.55]} position={[0, 0.45, 1.15]} castShadow />
          <mesh geometry={geoCylinder} material={matWoodDark} scale={[0.09, 0.42, 0.09]} position={[0, 0.22, 1.15]} />
        </group>
      ))}
    </group>
  );
});

// ---------------------------------------------------------------------------
// RestroomSet — 2 stalls + vanity with 2 sinks + mirror.
// Anchor at local origin; fixtures span local x 0..4.4, z 0..1.7.
// ---------------------------------------------------------------------------

export const FallbackRestroomSet = memo(function FallbackRestroomSet({
  position = [0, 0, 0],
  rotationY = 0,
}: PlacedProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* stall dividers */}
      {[0, 1.15, 2.3].map((x) => (
        <mesh key={x} geometry={geoBox} material={matSteel} scale={[0.06, 2.0, 1.5]} position={[x, 1.0, 0.85]} castShadow />
      ))}
      {/* stall back wall */}
      <mesh geometry={geoBox} material={matSteel} scale={[2.36, 2.0, 0.06]} position={[1.15, 1.0, 0.12]} />
      {/* stall doors */}
      {[0.575, 1.725].map((x) => (
        <mesh key={x} geometry={geoBox} material={matWood} scale={[1.05, 1.9, 0.06]} position={[x, 0.95, 1.58]} castShadow />
      ))}
      {/* vanity */}
      <mesh geometry={geoBox} material={matWoodDark} scale={[1.9, 0.85, 0.55]} position={[3.35, 0.425, 0.4]} castShadow />
      <mesh geometry={geoBox} material={matSteel} scale={[2.0, 0.06, 0.6]} position={[3.35, 0.88, 0.4]} />
      {[2.9, 3.8].map((x) => (
        <group key={x}>
          <mesh geometry={geoCylinder} material={matFabric} scale={[0.56, 0.14, 0.56]} position={[x, 0.95, 0.4]} />
          <mesh geometry={geoCylinder} material={matSteel} scale={[0.05, 0.22, 0.05]} position={[x, 1.05, 0.22]} />
        </group>
      ))}
      {/* mirror backing + mirror */}
      <mesh geometry={geoBox} material={matWoodDark} scale={[2.0, 2.4, 0.08]} position={[3.35, 1.2, 0.02]} />
      <mesh geometry={geoBox} material={matSteel} scale={[1.8, 0.9, 0.05]} position={[3.35, 1.6, 0.08]} />
    </group>
  );
});

// ---------------------------------------------------------------------------
// Railing — posts + top/mid rails along local X
// ---------------------------------------------------------------------------

interface FallbackRailingProps extends PlacedProps {
  length: number;
}

export const FallbackRailing = memo(function FallbackRailing({
  length,
  position = [0, 0, 0],
  rotationY = 0,
}: FallbackRailingProps) {
  const n = Math.max(2, Math.round(length / 1.2) + 1);
  const step = length / (n - 1);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {Array.from({ length: n }, (_, i) => (
        <mesh
          key={i}
          geometry={geoBox}
          material={matDark}
          scale={[0.08, 1.05, 0.08]}
          position={[-length / 2 + i * step, 0.525, 0]}
          castShadow
        />
      ))}
      <mesh geometry={geoBox} material={matWoodDark} scale={[length, 0.09, 0.14]} position={[0, 1.06, 0]} castShadow />
      <mesh geometry={geoBox} material={matDark} scale={[length, 0.06, 0.08]} position={[0, 0.55, 0]} />
    </group>
  );
});

// ---------------------------------------------------------------------------
// Door — frame + solid or glass panel, `width` wide opening
// ---------------------------------------------------------------------------

interface FallbackDoorProps extends PlacedProps {
  glass?: boolean;
  width?: number;
}

export const FallbackDoor = memo(function FallbackDoor({
  position = [0, 0, 0],
  rotationY = 0,
  glass = false,
  width = 2,
}: FallbackDoorProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matWoodDark} scale={[0.14, 2.3, 0.34]} position={[-(width / 2 - 0.07), 1.15, 0]} castShadow />
      <mesh geometry={geoBox} material={matWoodDark} scale={[0.14, 2.3, 0.34]} position={[width / 2 - 0.07, 1.15, 0]} castShadow />
      <mesh geometry={geoBox} material={matWoodDark} scale={[width, 0.18, 0.34]} position={[0, 2.3, 0]} />
      {glass ? (
        <mesh geometry={geoBox} material={matGlass} scale={[width - 0.2, 2.05, 0.06]} position={[0, 1.05, 0]} />
      ) : (
        <group>
          <mesh geometry={geoBox} material={matWood} scale={[width - 0.2, 2.05, 0.08]} position={[0, 1.05, 0]} castShadow />
          <mesh geometry={geoSphere} material={matSteel} scale={[0.09, 0.09, 0.09]} position={[width / 2 - 0.45, 1.05, 0.08]} />
        </group>
      )}
    </group>
  );
});

// ---------------------------------------------------------------------------
// FallbackBuildingShell — minimal slabs + exterior walls honoring the
// same props the real BuildingShell takes.
// ---------------------------------------------------------------------------

interface FallbackBuildingShellProps {
  showGround: boolean;
  showSecond: boolean;
  showRoof: boolean;
  cutSouthWalls: boolean;
}

export const FallbackBuildingShell = memo(function FallbackBuildingShell({
  showGround,
  showSecond,
  showRoof,
  cutSouthWalls,
}: FallbackBuildingShellProps) {
  const { minX, maxX, minZ, maxZ } = BUILDING;
  const w = maxX - minX; // 40
  const d = maxZ - minZ; // 28
  const cz = (minZ + maxZ) / 2; // 0
  const floorWalls = (floorY: number, key: string) => (
    <group key={key}>
      <Wall length={w} height={WALL_H} position={[0, floorY, minZ]} windows={6} />
      {!cutSouthWalls && (
        <Wall length={w} height={WALL_H} position={[0, floorY, maxZ]} rotationY={Math.PI} windows={6} />
      )}
      <Wall length={d} height={WALL_H} position={[minX, floorY, cz]} rotationY={Math.PI / 2} windows={4} />
      <Wall length={d} height={WALL_H} position={[maxX, floorY, cz]} rotationY={-Math.PI / 2} windows={4} />
    </group>
  );
  return (
    <group>
      {/* ground slab */}
      <mesh geometry={geoBox} material={matFloor} scale={[w + 0.6, 0.2, d + 0.6]} position={[0, -0.1, cz]} receiveShadow />
      {showGround && floorWalls(0, "g")}
      {showSecond && (
        <group>
          <mesh
            geometry={geoBox}
            material={matFloor}
            scale={[w + 0.6, 0.25, d + 0.6]}
            position={[0, FLOOR_HEIGHT - 0.125, cz]}
            receiveShadow
          />
          {floorWalls(FLOOR_HEIGHT, "s")}
        </group>
      )}
      {showRoof && (
        <mesh
          geometry={geoBox}
          material={matWall}
          scale={[w + 0.6, 0.25, d + 0.6]}
          position={[0, FLOOR_HEIGHT + WALL_H + 0.125, cz]}
          castShadow
        />
      )}
    </group>
  );
});

// ---------------------------------------------------------------------------
// FallbackExterior — ground plane, walkway, a few trees
// ---------------------------------------------------------------------------

export const FallbackExterior = memo(function FallbackExterior() {
  const trees: Array<[number, number, number]> = [
    [-26, -8, 1.2],
    [26, 6, 1.5],
    [-24, 12, 1.0],
    [28, -10, 1.3],
    [12, 21, 1.1],
    [-12, -21, 1.4],
  ];
  return (
    <group>
      <mesh
        geometry={geoPlane}
        material={matGrass}
        scale={[220, 160, 1]}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.22, 0]}
        receiveShadow
      />
      {/* walkway to the reception entrance (x 12..16, z=14) */}
      <mesh geometry={geoBox} material={matWalk} scale={[5, 0.06, 12]} position={[14, -0.17, 20]} receiveShadow />
      {trees.map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]} scale={s}>
          <mesh geometry={geoCylinder} material={matTrunk} scale={[0.35, 1.6, 0.35]} position={[0, 0.8, 0]} castShadow />
          <mesh geometry={geoCone} material={matLeaf} scale={[2.2, 3.2, 2.2]} position={[0, 3.0, 0]} castShadow />
        </group>
      ))}
      {/* entry canopy posts flanking the walkway */}
      {[-2.2, 2.2].map((dx) => (
        <mesh
          key={dx}
          geometry={geoCylinder}
          material={matDeskLeg}
          scale={[0.18, 3.0, 0.18]}
          position={[14 + dx, 1.5, 15.5]}
          castShadow
        />
      ))}
      <mesh geometry={geoBox} material={matDark} scale={[5.4, 0.15, 2.2]} position={[14, 3.05, 15.5]} castShadow />
    </group>
  );
});
