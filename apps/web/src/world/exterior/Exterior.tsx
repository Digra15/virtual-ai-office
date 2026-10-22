import { memo } from "react";
import * as THREE from "three";
import { geoBox, geoCone, geoCylinder, geoPlane, geoSphere } from "../geometries";
import { Tree } from "../furniture/Tree";
import { Bench } from "../furniture/Bench";
import { Planter } from "../furniture/Planter";
import { BikeRack } from "../furniture/BikeRack";
import { Pergola } from "../furniture/Pergola";

// --- inline materials (new colors; materials.ts left untouched) ---
const matGrass = new THREE.MeshStandardMaterial({ color: "#3d6b35", roughness: 1 });
const matWalk = new THREE.MeshStandardMaterial({ color: "#7d8590", roughness: 0.95 });
const matSoil = new THREE.MeshStandardMaterial({ color: "#2e2118", roughness: 1 });
const matBedBorder = new THREE.MeshStandardMaterial({ color: "#5b422c", roughness: 0.9 });
const matFlowerPink = new THREE.MeshStandardMaterial({ color: "#ec4899", roughness: 0.8 });
const matFlowerYellow = new THREE.MeshStandardMaterial({ color: "#facc15", roughness: 0.8 });
const matFlowerWhite = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.8 });
const matAsphalt = new THREE.MeshStandardMaterial({ color: "#232a35", roughness: 0.95 });
const matLine = new THREE.MeshStandardMaterial({ color: "#e5e7eb", roughness: 0.9 });
const matPole = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.5, metalness: 0.6 });
const matLampGlow = new THREE.MeshStandardMaterial({
  color: "#fef3c7",
  emissive: new THREE.Color("#fde68a"),
  emissiveIntensity: 1.8,
  roughness: 0.5,
});
const matTableWood = new THREE.MeshStandardMaterial({ color: "#7a5a38", roughness: 0.85 });
const matStool = new THREE.MeshStandardMaterial({ color: "#31405c", roughness: 0.8 });
const matPatio = new THREE.MeshStandardMaterial({ color: "#4b5563", roughness: 0.95 });

const FLOWER_MATS = [matFlowerPink, matFlowerYellow, matFlowerWhite];

const TREE_SPOTS: [number, number, number][] = [
  [-30, -10, 1.1], [-34, 8, 0.9], [-32, 24, 1.2], [-40, -24, 1.0], [-28, -32, 1.15],
  [-10, -30, 1.0], [6, -34, 1.2], [18, -28, 0.95],
  [32, -18, 1.1], [36, -2, 1.0], [34, 14, 1.15], [40, 26, 1.0],
  [-24, 26, 0.9], [24, 30, 1.05],
];

const LAMP_SPOTS: [number, number][] = [
  [10, 18], [18, 18], [10, 30], [18, 30], [-10, 20], [28, 10],
];

/** One garden bed: soil + border + 6 flower cones. */
const GardenBed = memo(function GardenBed({ position }: { position: [number, number, number] }) {
  const flowers: { x: number; z: number; i: number }[] = [];
  [-0.9, 0, 0.9].forEach((x, xi) => {
    [-0.35, 0.35].forEach((z, zi) => flowers.push({ x, z, i: xi * 2 + zi }));
  });
  return (
    <group position={position}>
      <mesh geometry={geoBox} material={matSoil} scale={[3, 0.25, 1.5]} position={[0, 0.125, 0]} receiveShadow />
      <mesh geometry={geoBox} material={matBedBorder} scale={[3.2, 0.3, 0.12]} position={[0, 0.15, 0.72]} />
      <mesh geometry={geoBox} material={matBedBorder} scale={[3.2, 0.3, 0.12]} position={[0, 0.15, -0.72]} />
      <mesh geometry={geoBox} material={matBedBorder} scale={[0.12, 0.3, 1.56]} position={[1.54, 0.15, 0]} />
      <mesh geometry={geoBox} material={matBedBorder} scale={[0.12, 0.3, 1.56]} position={[-1.54, 0.15, 0]} />
      {flowers.map((f) => (
        <group key={`${f.x}:${f.z}`} position={[f.x, 0, f.z]}>
          <mesh geometry={geoCylinder} material={matBedBorder} scale={[0.07, 0.45, 0.07]} position={[0, 0.45, 0]} />
          <mesh geometry={geoCone} material={FLOWER_MATS[f.i % 3]} scale={[0.32, 0.45, 0.32]} position={[0, 0.8, 0]} castShadow />
        </group>
      ))}
    </group>
  );
});

/** One exterior lamp post (emissive head only, no real light). */
const LampPost = memo(function LampPost({ position }: { position: [number, number] }) {
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh geometry={geoCylinder} material={matPole} scale={[0.16, 4.2, 0.16]} position={[0, 2.1, 0]} castShadow />
      <mesh geometry={geoBox} material={matPole} scale={[0.34, 0.18, 0.34]} position={[0, 4.28, 0]} />
      <mesh geometry={geoSphere} material={matLampGlow} scale={[0.3, 0.3, 0.3]} position={[0, 4.08, 0]} />
    </group>
  );
});

/** Simple low-poly car. */
const Car = memo(function Car({
  position,
  rotationY = 0,
  color,
}: {
  position: [number, number, number];
  rotationY?: number;
  color: string;
}) {
  const matBody = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5 });
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matBody} scale={[3.6, 0.7, 1.7]} position={[0, 0.6, 0]} castShadow />
      <mesh geometry={geoBox} material={matBody} scale={[1.9, 0.55, 1.5]} position={[-0.2, 1.2, 0]} castShadow />
      {[
        [1.15, 0.85], [1.15, -0.85], [-1.15, 0.85], [-1.15, -0.85],
      ].map(([x, z]) => (
        <mesh
          key={`${x}:${z}`}
          geometry={geoCylinder}
          material={matPole}
          scale={[0.7, 0.5, 0.7]}
          position={[x, 0.35, z]}
          rotation={[0, 0, Math.PI / 2]}
        />
      ))}
    </group>
  );
});

/**
 * Building surroundings: grass, sidewalks, garden beds, trees, benches,
 * planters, bike rack, west parking, lamp posts, and the south-west patio.
 */
export const Exterior = memo(function Exterior() {
  return (
    <group>
      {/* grass */}
      <mesh geometry={geoPlane} material={matGrass} scale={[140, 140, 1]} position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />

      {/* sidewalk: reception doors (14,0,14) -> (14,0,32) */}
      <mesh geometry={geoBox} material={matWalk} scale={[4, 0.1, 18]} position={[14, 0.05, 23]} receiveShadow />
      {/* path to the stair tower east side */}
      <mesh geometry={geoBox} material={matWalk} scale={[12, 0.1, 3]} position={[22, 0.05, 16]} receiveShadow />
      <mesh geometry={geoBox} material={matWalk} scale={[3, 0.1, 14]} position={[25.5, 0.05, 9]} receiveShadow />

      {/* garden beds near the entrance */}
      <GardenBed position={[8, 0, 17]} />
      <GardenBed position={[20, 0, 17]} />
      <GardenBed position={[8, 0, 27]} />
      <GardenBed position={[20, 0, 27]} />

      {/* trees (edges only, clear of the default camera sightline) */}
      {TREE_SPOTS.map(([x, z, s], i) => (
        <Tree key={i} position={[x, 0, z]} scale={s} />
      ))}

      {/* benches + planters near the entrance */}
      <Bench position={[7, 0, 19]} rotationY={Math.PI / 2} />
      <Bench position={[21, 0, 20]} rotationY={-Math.PI / 2} />
      <Planter position={[10.5, 0, 16]} />
      <Planter position={[17.5, 0, 16]} />
      <Planter position={[10.5, 0, 30]} />
      <Planter position={[17.5, 0, 30]} />

      {/* bike rack (east) */}
      <BikeRack position={[28, 0, 3]} rotationY={Math.PI / 2} />

      {/* west parking: 4 marked spots, 2 cars */}
      <mesh geometry={geoBox} material={matAsphalt} scale={[8, 0.08, 20]} position={[-33, 0.04, 0]} receiveShadow />
      {[-7, -3.5, 0, 3.5, 7].map((z) => (
        <mesh key={z} geometry={geoBox} material={matLine} scale={[7, 0.02, 0.12]} position={[-33, 0.1, z]} />
      ))}
      <Car position={[-33, 0.08, -5.25]} color="#b91c1c" />
      <Car position={[-33, 0.08, 1.75]} rotationY={Math.PI} color="#1d4ed8" />

      {/* lamp posts */}
      {LAMP_SPOTS.map(([x, z], i) => (
        <LampPost key={i} position={[x, z]} />
      ))}

      {/* south-west patio: pergola + outdoor table + 4 stools */}
      <mesh geometry={geoBox} material={matPatio} scale={[8, 0.08, 8]} position={[-10, 0.04, 20]} receiveShadow />
      <Pergola position={[-10, 0, 20]} />
      <mesh geometry={geoCylinder} material={matTableWood} scale={[1.4, 0.08, 1.4]} position={[-10, 0.7, 20]} castShadow />
      <mesh geometry={geoCylinder} material={matTableWood} scale={[0.16, 0.66, 0.16]} position={[-10, 0.33, 20]} castShadow />
      {[
        [-8.7, 20], [-11.3, 20], [-10, 18.7], [-10, 21.3],
      ].map(([x, z]) => (
        <group key={`${x}:${z}`} position={[x, 0, z]}>
          <mesh geometry={geoCylinder} material={matStool} scale={[0.55, 0.09, 0.55]} position={[0, 0.45, 0]} castShadow />
          <mesh geometry={geoCylinder} material={matTableWood} scale={[0.1, 0.41, 0.1]} position={[0, 0.2, 0]} />
        </group>
      ))}
    </group>
  );
});
