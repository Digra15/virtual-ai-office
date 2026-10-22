import { memo } from "react";
import * as THREE from "three";
import { geoBox } from "../geometries";

interface RailingProps {
  length: number;
  position?: [number, number, number];
  rotationY?: number;
}

const matRail = new THREE.MeshStandardMaterial({ color: "#1a2230", roughness: 0.45, metalness: 0.6 });

/** Simple railing segment running along local X (terrace edge, etc.). */
export const Railing = memo(function Railing({
  length,
  position = [0, 0, 0],
  rotationY = 0,
}: RailingProps) {
  const n = Math.max(2, Math.round(length / 1.2) + 1);
  const posts = Array.from({ length: n }, (_, i) => -length / 2 + (i * length) / (n - 1));

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {posts.map((x) => (
        <mesh
          key={x}
          geometry={geoBox}
          material={matRail}
          scale={[0.07, 0.95, 0.07]}
          position={[x, 0.475, 0]}
          castShadow
        />
      ))}
      <mesh geometry={geoBox} material={matRail} scale={[length, 0.09, 0.09]} position={[0, 0.95, 0]} castShadow />
      <mesh geometry={geoBox} material={matRail} scale={[length, 0.05, 0.05]} position={[0, 0.5, 0]} />
    </group>
  );
});
