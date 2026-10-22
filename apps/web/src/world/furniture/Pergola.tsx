import { memo } from "react";
import * as THREE from "three";
import { geoBox } from "../geometries";

interface FurnitureProps {
  position?: [number, number, number];
  rotationY?: number;
}

const matWood = new THREE.MeshStandardMaterial({ color: "#8a6a42", roughness: 0.85 });

/** Pergola: 4 posts + beam + slat roof. */
export const Pergola = memo(function Pergola({
  position = [0, 0, 0],
  rotationY = 0,
}: FurnitureProps) {
  const slats = Array.from({ length: 7 }, (_, i) => -1.8 + i * 0.6);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[
        [-1.9, -1.9],
        [1.9, -1.9],
        [-1.9, 1.9],
        [1.9, 1.9],
      ].map(([x, z]) => (
        <mesh key={`${x}:${z}`} geometry={geoBox} material={matWood} scale={[0.22, 2.6, 0.22]} position={[x, 1.3, z]} castShadow />
      ))}
      {/* beams */}
      {[-1.9, 1.9].map((z) => (
        <mesh key={z} geometry={geoBox} material={matWood} scale={[4.2, 0.18, 0.18]} position={[0, 2.65, z]} castShadow />
      ))}
      {/* slats */}
      {slats.map((x) => (
        <mesh key={x} geometry={geoBox} material={matWood} scale={[0.28, 0.08, 4.2]} position={[x, 2.78, 0]} castShadow />
      ))}
    </group>
  );
});
