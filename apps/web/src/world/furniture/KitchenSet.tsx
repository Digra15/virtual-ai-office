import { memo } from "react";
import * as THREE from "three";
import { geoBox, geoCylinder } from "../geometries";

interface FurnitureProps {
  position?: [number, number, number];
  rotationY?: number;
}

const matCabinet = new THREE.MeshStandardMaterial({ color: "#3a4a63", roughness: 0.6 });
const matCounterTop = new THREE.MeshStandardMaterial({ color: "#dbe3ee", roughness: 0.3 });
const matSink = new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.35, metalness: 0.7 });
const matFaucet = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.25, metalness: 0.85 });
const matFridge = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.35, metalness: 0.4 });
const matDark = new THREE.MeshStandardMaterial({ color: "#141a24", roughness: 0.5 });
const matButtonGlow = new THREE.MeshStandardMaterial({
  color: "#052e16",
  emissive: new THREE.Color("#22c55e"),
  emissiveIntensity: 1.4,
  roughness: 0.4,
});
const matCoffeeDark = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.45, metalness: 0.5 });

/**
 * Pantry counter run: base cabinets, countertop, sink basin, bent faucet,
 * and upper wall cabinets.
 */
export const KitchenSet = memo(function KitchenSet({
  position = [0, 0, 0],
  rotationY = 0,
}: FurnitureProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* base cabinets */}
      <mesh geometry={geoBox} material={matCabinet} scale={[3.6, 0.86, 0.62]} position={[0, 0.43, 0]} castShadow receiveShadow />
      {/* countertop */}
      <mesh geometry={geoBox} material={matCounterTop} scale={[3.7, 0.06, 0.7]} position={[0, 0.89, 0]} castShadow />
      {/* sink basin */}
      <mesh geometry={geoBox} material={matSink} scale={[0.8, 0.22, 0.5]} position={[-0.9, 0.82, 0]} receiveShadow />
      <mesh geometry={geoBox} material={matDark} scale={[0.68, 0.18, 0.4]} position={[-0.9, 0.86, 0]} />
      {/* faucet: vertical + horizontal + down spout */}
      <mesh geometry={geoCylinder} material={matFaucet} scale={[0.07, 0.42, 0.07]} position={[-0.9, 1.12, -0.22]} />
      <mesh geometry={geoCylinder} material={matFaucet} scale={[0.06, 0.3, 0.06]} position={[-0.9, 1.31, -0.1]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={geoCylinder} material={matFaucet} scale={[0.06, 0.14, 0.06]} position={[-0.9, 1.24, 0.04]} />
      {/* upper cabinets */}
      <mesh geometry={geoBox} material={matCabinet} scale={[1.4, 0.7, 0.35]} position={[-0.9, 1.95, -0.14]} castShadow />
      <mesh geometry={geoBox} material={matCabinet} scale={[1.4, 0.7, 0.35]} position={[0.6, 1.95, -0.14]} castShadow />
      {/* cabinet door seams */}
      <mesh geometry={geoBox} material={matDark} scale={[0.02, 0.6, 0.02]} position={[-0.9, 1.95, 0.045]} />
      <mesh geometry={geoBox} material={matDark} scale={[0.02, 0.6, 0.02]} position={[0.6, 1.95, 0.045]} />
    </group>
  );
});

/** Countertop coffee machine with glowing buttons. */
export const CoffeeMachine = memo(function CoffeeMachine({
  position = [0, 0, 0],
  rotationY = 0,
}: FurnitureProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matCoffeeDark} scale={[0.5, 0.62, 0.45]} position={[0, 0.31, 0]} castShadow />
      <mesh geometry={geoBox} material={matFridge} scale={[0.4, 0.3, 0.02]} position={[0, 0.42, 0.23]} />
      {/* drip tray + spout */}
      <mesh geometry={geoBox} material={matDark} scale={[0.36, 0.05, 0.3]} position={[0, 0.06, 0.06]} />
      <mesh geometry={geoBox} material={matDark} scale={[0.08, 0.12, 0.08]} position={[0, 0.14, 0.06]} />
      {/* glowing buttons */}
      {[0, 1].map((i) => (
        <mesh
          key={i}
          geometry={geoBox}
          material={matButtonGlow}
          scale={[0.06, 0.06, 0.03]}
          position={[-0.08 + i * 0.16, 0.52, 0.225]}
        />
      ))}
    </group>
  );
});

/** Tall fridge with door split and handles. */
export const Fridge = memo(function Fridge({
  position = [0, 0, 0],
  rotationY = 0,
}: FurnitureProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matFridge} scale={[0.9, 1.9, 0.8]} position={[0, 0.95, 0]} castShadow receiveShadow />
      {/* door split */}
      <mesh geometry={geoBox} material={matDark} scale={[0.86, 0.02, 0.02]} position={[0, 1.25, 0.41]} />
      {/* handles */}
      <mesh geometry={geoBox} material={matDark} scale={[0.05, 0.5, 0.06]} position={[-0.3, 1.6, 0.43]} />
      <mesh geometry={geoBox} material={matDark} scale={[0.05, 0.35, 0.06]} position={[-0.3, 0.85, 0.43]} />
      {/* kick plate */}
      <mesh geometry={geoBox} material={matDark} scale={[0.86, 0.1, 0.76]} position={[0, 0.05, 0]} />
    </group>
  );
});
