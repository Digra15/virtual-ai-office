import { memo } from "react";
import * as THREE from "three";
import { geoBox, geoPlane } from "../geometries";
import { Signage } from "./Signage";

interface FurnitureProps {
  position?: [number, number, number];
  rotationY?: number;
}

const matCounterBody = new THREE.MeshStandardMaterial({ color: "#31405c", roughness: 0.6 });
const matCounterTop = new THREE.MeshStandardMaterial({ color: "#dbe3ee", roughness: 0.3 });
const matKick = new THREE.MeshStandardMaterial({ color: "#141a24", roughness: 0.6 });

/** L-shaped reception counter with a small logo panel. */
export const ReceptionCounter = memo(function ReceptionCounter({
  position = [0, 0, 0],
  rotationY = 0,
}: FurnitureProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* long run */}
      <mesh geometry={geoBox} material={matKick} scale={[3.4, 0.12, 0.7]} position={[0, 0.06, 0]} />
      <mesh geometry={geoBox} material={matCounterBody} scale={[3.4, 0.95, 0.7]} position={[0, 0.6, 0]} castShadow receiveShadow />
      <mesh geometry={geoBox} material={matCounterTop} scale={[3.6, 0.08, 0.9]} position={[0, 1.12, 0]} castShadow />
      {/* return run (L shape) */}
      <mesh geometry={geoBox} material={matCounterBody} scale={[0.7, 0.95, 1.8]} position={[1.7, 0.6, 1.25]} castShadow receiveShadow />
      <mesh geometry={geoBox} material={matCounterTop} scale={[0.9, 0.08, 2.0]} position={[1.7, 1.12, 1.25]} castShadow />
      {/* logo panel on the front face */}
      <mesh geometry={geoBox} material={matCounterBody} scale={[1.6, 0.5, 0.04]} position={[-0.4, 0.62, -0.37]} />
      <mesh geometry={geoPlane} material={matCounterTop} scale={[1.5, 0.42, 1]} position={[-0.4, 0.62, -0.395]} rotation={[0, Math.PI, 0]} />
      <Signage position={[-0.4, 1.55, -0.42]} rotationY={Math.PI} text="DIFIA" scale={0.55} />
    </group>
  );
});
