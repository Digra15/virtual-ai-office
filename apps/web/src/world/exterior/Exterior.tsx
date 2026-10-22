/**
 * Building surroundings (simplified 2026-10-22): grass, the reception
 * sidewalk path, ~6 trees, 4 lamp posts, 2 planters. Lamp heads glow
 * bright at night (dim by day).
 */
import { memo, useEffect } from "react";
import * as THREE from "three";
import { geoBox, geoCylinder, geoPlane, geoSphere } from "../geometries";
import { useDayNightStore } from "../../stores/useDayNightStore";
import { Tree } from "../furniture/Tree";
import { Planter } from "../furniture/Planter";

// --- inline materials (new colors; materials.ts left untouched) ---
const matGrass = new THREE.MeshStandardMaterial({ color: "#3d6b35", roughness: 1 });
const matWalk = new THREE.MeshStandardMaterial({ color: "#7d8590", roughness: 0.95 });
const matPole = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.5, metalness: 0.6 });
const matLampGlow = new THREE.MeshStandardMaterial({
  color: "#fef3c7",
  emissive: new THREE.Color("#fde68a"),
  emissiveIntensity: 1.8,
  roughness: 0.5,
});

const TREE_SPOTS: [number, number, number][] = [
  [-30, -10, 1.1], [-34, 8, 0.9], [-32, 24, 1.2],
  [32, -18, 1.1], [36, -2, 1.0], [24, 30, 1.05],
];

const LAMP_SPOTS: [number, number][] = [
  [10, 18], [18, 18], [10, 30], [18, 30],
];

/** One exterior lamp post; the head glows bright at night. */
const LampPost = memo(function LampPost({ position }: { position: [number, number] }) {
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh geometry={geoCylinder} material={matPole} scale={[0.16, 4.2, 0.16]} position={[0, 2.1, 0]} castShadow />
      <mesh geometry={geoBox} material={matPole} scale={[0.34, 0.18, 0.34]} position={[0, 4.28, 0]} />
      <mesh geometry={geoSphere} material={matLampGlow} scale={[0.3, 0.3, 0.3]} position={[0, 4.08, 0]} />
    </group>
  );
});

export const Exterior = memo(function Exterior() {
  const isNight = useDayNightStore((s) => s.isNight);
  useEffect(() => {
    matLampGlow.emissiveIntensity = isNight ? 2.2 : 0.3;
  }, [isNight]);

  return (
    <group>
      {/* grass */}
      <mesh geometry={geoPlane} material={matGrass} scale={[140, 140, 1]} position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />

      {/* sidewalk: reception doors (14,0,14) -> (14,0,32) */}
      <mesh geometry={geoBox} material={matWalk} scale={[4, 0.1, 18]} position={[14, 0.05, 23]} receiveShadow />

      {/* trees */}
      {TREE_SPOTS.map(([x, z, s], i) => (
        <Tree key={i} position={[x, 0, z]} scale={s} />
      ))}

      {/* lamp posts */}
      {LAMP_SPOTS.map(([x, z], i) => (
        <LampPost key={i} position={[x, z]} />
      ))}

      {/* planters near the entrance */}
      <Planter position={[10.5, 0, 16]} />
      <Planter position={[17.5, 0, 16]} />
    </group>
  );
});
