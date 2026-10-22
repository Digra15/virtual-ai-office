import { memo } from "react";
import * as THREE from "three";
import { geoBox } from "../geometries";

interface FurnitureProps {
  position?: [number, number, number];
  rotationY?: number;
}

const matWood = new THREE.MeshStandardMaterial({ color: "#7a5a38", roughness: 0.85 });
const matIron = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.5, metalness: 0.6 });

/** Simple park bench: slatted seat + backrest + iron legs. */
export const Bench = memo(function Bench({
  position = [0, 0, 0],
  rotationY = 0,
}: FurnitureProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* seat slats */}
      {[-0.18, 0, 0.18].map((z) => (
        <mesh key={z} geometry={geoBox} material={matWood} scale={[1.8, 0.06, 0.14]} position={[0, 0.46, z]} castShadow />
      ))}
      {/* backrest slats */}
      {[-0.14, 0.14].map((dy, i) => (
        <mesh
          key={i}
          geometry={geoBox}
          material={matWood}
          scale={[1.8, 0.14, 0.05]}
          position={[0, 0.72 + dy, -0.28]}
          rotation={[-0.15, 0, 0]}
          castShadow
        />
      ))}
      {/* legs */}
      {[-0.75, 0.75].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh geometry={geoBox} material={matIron} scale={[0.08, 0.46, 0.5]} position={[0, 0.23, 0]} />
          <mesh geometry={geoBox} material={matIron} scale={[0.08, 0.5, 0.08]} position={[0, 0.7, -0.27]} rotation={[-0.15, 0, 0]} />
        </group>
      ))}
    </group>
  );
});
