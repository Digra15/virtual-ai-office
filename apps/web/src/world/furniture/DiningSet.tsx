import { memo } from "react";
import * as THREE from "three";
import { geoCylinder } from "../geometries";

interface FurnitureProps {
  position?: [number, number, number];
  rotationY?: number;
}

const matTableTop = new THREE.MeshStandardMaterial({ color: "#5c4630", roughness: 0.7 });
const matTableLeg = new THREE.MeshStandardMaterial({ color: "#2b2117", roughness: 0.6, metalness: 0.4 });
const matStool = new THREE.MeshStandardMaterial({ color: "#31405c", roughness: 0.8 });

/** Round dining table with 4 stools. */
export const DiningSet = memo(function DiningSet({
  position = [0, 0, 0],
  rotationY = 0,
}: FurnitureProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* table top + pedestal */}
      <mesh geometry={geoCylinder} material={matTableTop} scale={[1.5, 0.08, 1.5]} position={[0, 0.72, 0]} castShadow receiveShadow />
      <mesh geometry={geoCylinder} material={matTableLeg} scale={[0.18, 0.68, 0.18]} position={[0, 0.34, 0]} castShadow />
      <mesh geometry={geoCylinder} material={matTableLeg} scale={[0.8, 0.06, 0.8]} position={[0, 0.03, 0]} />
      {/* 4 stools */}
      {[
        [1.25, 0],
        [-1.25, 0],
        [0, 1.25],
        [0, -1.25],
      ].map(([x, z]) => (
        <group key={`${x}:${z}`} position={[x, 0, z]}>
          <mesh geometry={geoCylinder} material={matStool} scale={[0.7, 0.09, 0.7]} position={[0, 0.47, 0]} castShadow />
          <mesh geometry={geoCylinder} material={matTableLeg} scale={[0.1, 0.43, 0.1]} position={[0, 0.215, 0]} />
          <mesh geometry={geoCylinder} material={matTableLeg} scale={[0.5, 0.05, 0.5]} position={[0, 0.025, 0]} />
        </group>
      ))}
    </group>
  );
});
