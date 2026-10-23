/**
 * Building surroundings (single-floor plan, kept light): a neutral
 * ground plane, the asphalt strip + curb in front of the entrance, a
 * WELCOME mat, one simple white car, a bike rack, and 4 potted plants
 * along the facade. Shared geometries/materials only, no extra shadow
 * lights — the mesh-budget discipline.
 */
import { memo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { CozyPlant } from "../cozy";
import { geoBox, geoCylinder, geoPlane } from "../geometries";

const matGround = new THREE.MeshStandardMaterial({ color: "#4a5548", roughness: 1 });
const matAsphalt = new THREE.MeshStandardMaterial({ color: "#3a3f45", roughness: 0.95 });
const matCurb = new THREE.MeshStandardMaterial({ color: "#9aa0a8", roughness: 0.9 });
const matMat = new THREE.MeshStandardMaterial({ color: "#b91c1c", roughness: 0.95 });
const matCarWhite = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.35, metalness: 0.15 });
const matCarGlass = new THREE.MeshStandardMaterial({ color: "#1e3a4c", roughness: 0.15, metalness: 0.4 });
const matTire = new THREE.MeshStandardMaterial({ color: "#15181d", roughness: 0.9 });
const matRackMetal = new THREE.MeshStandardMaterial({ color: "#6b7280", roughness: 0.4, metalness: 0.7 });

const PLANT_XS = [-14, -8, 8, 14];

/** Simple white car at (13,0,14.5) + cabin. */
const Car = memo(function Car() {
  return (
    <group position={[13, 0, 14.5]}>
      {/* body */}
      <mesh geometry={geoBox} material={matCarWhite} scale={[1.8, 0.55, 4.2]} position={[0, 0.62, 0]} castShadow />
      {/* cabin */}
      <mesh geometry={geoBox} material={matCarGlass} scale={[1.6, 0.5, 2.0]} position={[0, 1.1, -0.2]} castShadow />
      {/* wheels */}
      {[
        [-0.85, 1.35],
        [0.85, 1.35],
        [-0.85, -1.35],
        [0.85, -1.35],
      ].map(([wx, wz]) => (
        <mesh
          key={`${wx}:${wz}`}
          geometry={geoCylinder}
          material={matTire}
          scale={[0.62, 0.4, 0.62]}
          position={[wx, 0.31, wz]}
          rotation={[0, 0, Math.PI / 2]}
        />
      ))}
    </group>
  );
});

/** Simple bike rack at (7.5,0.32,12.5): two rails + posts. */
const BikeRack = memo(function BikeRack() {
  return (
    <group position={[7.5, 0.32, 12.5]}>
      {[-1.2, 1.2].map((rz) => (
        <mesh key={rz} geometry={geoCylinder} material={matRackMetal} scale={[0.08, 2.6, 0.08]} position={[0, 0.35, rz]} rotation={[0, 0, Math.PI / 2]} castShadow />
      ))}
      {[-1.1, -0.37, 0.37, 1.1].map((px) => (
        <mesh key={px} geometry={geoBox} material={matRackMetal} scale={[0.08, 0.7, 0.08]} position={[px, 0.35, 0]} />
      ))}
    </group>
  );
});

export const Exterior = memo(function Exterior() {
  return (
    <group>
      {/* neutral ground */}
      <mesh geometry={geoPlane} material={matGround} scale={[160, 160, 1]} position={[0, -0.26, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      {/* asphalt strip: 42×14 at (0,-0.22,17) */}
      <mesh geometry={geoPlane} material={matAsphalt} scale={[42, 14, 1]} position={[0, -0.22, 17]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      {/* curb: 34×2.5 at (0,-0.11,10.75) */}
      <mesh geometry={geoBox} material={matCurb} scale={[34, 0.12, 2.5]} position={[0, -0.11, 10.75]} receiveShadow />
      {/* WELCOME mat */}
      <mesh geometry={geoPlane} material={matMat} scale={[3.0, 1.2, 1]} position={[0, 0.015, 10.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      <Text position={[0, 0.03, 10.6]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.42} color="#fef2f2" anchorX="center" anchorY="middle">
        WELCOME
      </Text>
      <Car />
      <BikeRack />
      {/* 4 potted plants along the facade */}
      {PLANT_XS.map((x) => (
        <CozyPlant key={x} position={[x, 0, 10.3]} />
      ))}
    </group>
  );
});
