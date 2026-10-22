import { memo } from "react";
import * as THREE from "three";
import { geoCone, geoCylinder } from "../geometries";

interface FurnitureProps {
  position?: [number, number, number];
  rotationY?: number;
}

const matPot = new THREE.MeshStandardMaterial({ color: "#6b4a2f", roughness: 0.9 });
const matSoil = new THREE.MeshStandardMaterial({ color: "#2e2118", roughness: 1 });
const matLeaf = new THREE.MeshStandardMaterial({ color: "#2d7a3f", roughness: 0.9 });
const matLeaf2 = new THREE.MeshStandardMaterial({ color: "#3f9e4d", roughness: 0.9 });

/** Planter pot with a small shrub. */
export const Planter = memo(function Planter({
  position = [0, 0, 0],
  rotationY = 0,
}: FurnitureProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoCylinder} material={matPot} scale={[0.9, 0.55, 0.9]} position={[0, 0.275, 0]} castShadow />
      <mesh geometry={geoCylinder} material={matSoil} scale={[0.78, 0.06, 0.78]} position={[0, 0.53, 0]} />
      <mesh geometry={geoCone} material={matLeaf2} scale={[0.9, 1.1, 0.9]} position={[0, 1.0, 0]} castShadow />
      <mesh geometry={geoCone} material={matLeaf} scale={[0.6, 0.8, 0.6]} position={[0, 1.55, 0]} castShadow />
    </group>
  );
});
