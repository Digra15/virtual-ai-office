import { memo } from "react";
import * as THREE from "three";
import { geoCone, geoCylinder } from "../geometries";

interface TreeProps {
  position?: [number, number, number];
  rotationY?: number;
  /** Overall tree height multiplier. */
  scale?: number;
}

const matTrunk = new THREE.MeshStandardMaterial({ color: "#5b422c", roughness: 0.95 });
const matLeaf = new THREE.MeshStandardMaterial({ color: "#2d7a3f", roughness: 0.9 });
const matLeaf2 = new THREE.MeshStandardMaterial({ color: "#3f9e4d", roughness: 0.9 });

/** Low-poly tree: cylinder trunk + two stacked foliage cones. */
export const Tree = memo(function Tree({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: TreeProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
      <mesh geometry={geoCylinder} material={matTrunk} scale={[0.45, 1.6, 0.45]} position={[0, 0.8, 0]} castShadow />
      <mesh geometry={geoCone} material={matLeaf} scale={[2.4, 2.6, 2.4]} position={[0, 2.5, 0]} castShadow />
      <mesh geometry={geoCone} material={matLeaf2} scale={[1.7, 1.9, 1.7]} position={[0, 3.9, 0]} castShadow />
    </group>
  );
});
