import { memo } from "react";
import * as THREE from "three";
import { geoBox, geoCylinder, geoSphere } from "../geometries";

interface FurnitureProps {
  position?: [number, number, number];
  rotationY?: number;
}

const matBedFrame = new THREE.MeshStandardMaterial({ color: "#4a3b2a", roughness: 0.75 });
const matMattress = new THREE.MeshStandardMaterial({ color: "#e8e0d2", roughness: 0.95 });
const matBlanket = new THREE.MeshStandardMaterial({ color: "#0d9488", roughness: 0.9 });
const matPillow = new THREE.MeshStandardMaterial({ color: "#f5efe4", roughness: 0.95 });
const matTableWood = new THREE.MeshStandardMaterial({ color: "#5c4630", roughness: 0.8 });
const matLampGlow = new THREE.MeshStandardMaterial({
  color: "#fde68a",
  emissive: new THREE.Color("#fde68a"),
  emissiveIntensity: 1.2,
  roughness: 0.5,
});

/**
 * Recovery pod: low cozy platform bed + pillow + folded blanket +
 * bedside table with a small lamp. Warm and cozy, NOT hospital.
 */
export const Bed = memo(function Bed({
  position = [0, 0, 0],
  rotationY = 0,
}: FurnitureProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* platform */}
      <mesh geometry={geoBox} material={matBedFrame} scale={[2.2, 0.22, 1.2]} position={[0, 0.28, 0]} castShadow receiveShadow />
      {/* headboard */}
      <mesh geometry={geoBox} material={matBedFrame} scale={[0.12, 0.9, 1.2]} position={[-1.1, 0.65, 0]} castShadow />
      {/* legs */}
      {[
        [-1.0, -0.5],
        [1.0, -0.5],
        [-1.0, 0.5],
        [1.0, 0.5],
      ].map(([x, z]) => (
        <mesh key={`${x}:${z}`} geometry={geoBox} material={matBedFrame} scale={[0.1, 0.18, 0.1]} position={[x, 0.09, z]} />
      ))}
      {/* mattress */}
      <mesh geometry={geoBox} material={matMattress} scale={[2.0, 0.2, 1.05]} position={[0.02, 0.49, 0]} castShadow receiveShadow />
      {/* pillow */}
      <mesh geometry={geoBox} material={matPillow} scale={[0.55, 0.16, 0.7]} position={[-0.62, 0.64, 0]} castShadow />
      {/* folded blanket */}
      <mesh geometry={geoBox} material={matBlanket} scale={[0.85, 0.13, 0.98]} position={[0.42, 0.65, 0]} castShadow />
      <mesh geometry={geoBox} material={matBlanket} scale={[0.85, 0.05, 0.3]} position={[0.42, 0.74, 0.28]} />
      {/* bedside table */}
      <mesh geometry={geoBox} material={matTableWood} scale={[0.55, 0.55, 0.55]} position={[1.45, 0.275, 0]} castShadow receiveShadow />
      {/* little lamp */}
      <mesh geometry={geoCylinder} material={matBedFrame} scale={[0.08, 0.28, 0.08]} position={[1.45, 0.69, 0]} />
      <mesh geometry={geoSphere} material={matLampGlow} scale={[0.22, 0.22, 0.22]} position={[1.45, 0.92, 0]} />
    </group>
  );
});
