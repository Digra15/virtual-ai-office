import { memo } from "react";
import * as THREE from "three";
import { geoBox, geoCylinder, geoTorus } from "../geometries";

interface FurnitureProps {
  position?: [number, number, number];
  rotationY?: number;
}

const matIron = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.5, metalness: 0.6 });
const bikeColors = [
  new THREE.MeshStandardMaterial({ color: "#dc2626", roughness: 0.5, metalness: 0.3 }),
  new THREE.MeshStandardMaterial({ color: "#2563eb", roughness: 0.5, metalness: 0.3 }),
  new THREE.MeshStandardMaterial({ color: "#f59e0b", roughness: 0.5, metalness: 0.3 }),
];

/** Bike rack with 3 simple bikes (torus wheels + box frame). */
export const BikeRack = memo(function BikeRack({
  position = [0, 0, 0],
  rotationY = 0,
}: FurnitureProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* rack: two posts + top bar */}
      {[-1.6, 1.6].map((x) => (
        <mesh key={x} geometry={geoCylinder} material={matIron} scale={[0.12, 0.85, 0.12]} position={[x, 0.425, 0]} castShadow />
      ))}
      <mesh geometry={geoBox} material={matIron} scale={[3.4, 0.08, 0.08]} position={[0, 0.82, 0]} />
      {/* bikes */}
      {[-1.1, 0, 1.1].map((x, i) => (
        <group key={i} position={[x, 0, 0.35]} rotation={[0, Math.PI / 2, 0]}>
          {/* wheels */}
          {[-0.55, 0.55].map((dz) => (
            <mesh key={dz} geometry={geoTorus} material={matIron} scale={[0.72, 0.72, 0.72]} position={[0, 0.36, dz]} />
          ))}
          {/* frame */}
          <mesh geometry={geoBox} material={bikeColors[i]} scale={[0.06, 0.06, 1.0]} position={[0, 0.62, 0]} />
          <mesh geometry={geoBox} material={bikeColors[i]} scale={[0.06, 0.5, 0.06]} position={[0, 0.45, -0.35]} rotation={[0.35, 0, 0]} />
          <mesh geometry={geoBox} material={bikeColors[i]} scale={[0.06, 0.5, 0.06]} position={[0, 0.45, 0.35]} rotation={[-0.35, 0, 0]} />
          {/* seat + handlebar */}
          <mesh geometry={geoBox} material={matIron} scale={[0.08, 0.06, 0.24]} position={[0, 0.82, -0.52]} />
          <mesh geometry={geoBox} material={matIron} scale={[0.3, 0.06, 0.06]} position={[0, 0.85, 0.55]} />
        </group>
      ))}
    </group>
  );
});
