/**
 * Pantry (x 0.5..8, z -12..-4.5): kitchen counter + fridge along the
 * north wall, round dining table with 4 chairs + 2 mugs.
 */
import { memo } from "react";
import * as THREE from "three";
import { CozyChair, Mug } from "../../cozy";
import { geoBox, geoCylinder } from "../../geometries";

const matCounterBase = new THREE.MeshStandardMaterial({ color: "#6b4a2f", roughness: 0.7 });
const matCounterTop = new THREE.MeshStandardMaterial({ color: "#e8e0d2", roughness: 0.35 });
const matFridge = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.3, metalness: 0.6 });
const matFridgeDark = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.5 });
const matTableWood = new THREE.MeshStandardMaterial({ color: "#9a6a3b", roughness: 0.6 });
const matTableDark = new THREE.MeshStandardMaterial({ color: "#5d3d22", roughness: 0.7 });

/** Dining chairs around the table at (4.2,-7.5), each facing the center. */
export const PANTRY_CHAIR_SLOTS: Array<{
  position: [number, number, number];
  rotationY: number;
}> = [
  { position: [4.2, 0, -8.5], rotationY: 0 }, // north — faces south
  { position: [4.2, 0, -6.5], rotationY: Math.PI }, // south — faces north
  { position: [3.2, 0, -7.5], rotationY: Math.PI / 2 }, // west — faces east
  { position: [5.2, 0, -7.5], rotationY: -Math.PI / 2 }, // east — faces west
];

/** Kitchen counter: 4.8-long run at (4.2,-11.4). */
const Counter = memo(function Counter() {
  return (
    <group position={[4.2, 0, -11.4]}>
      <mesh geometry={geoBox} material={matCounterBase} scale={[4.8, 0.85, 0.65]} position={[0, 0.425, 0]} castShadow receiveShadow />
      <mesh geometry={geoBox} material={matCounterTop} scale={[4.95, 0.06, 0.75]} position={[0, 0.88, 0]} castShadow />
      {/* sink */}
      <mesh geometry={geoBox} material={matFridgeDark} scale={[0.7, 0.12, 0.45]} position={[-1.2, 0.9, 0]} />
      <mesh geometry={geoCylinder} material={matFridge} scale={[0.06, 0.3, 0.06]} position={[-1.2, 1.05, -0.15]} />
    </group>
  );
});

/** Fridge at (7.1,-11.3). */
const Fridge = memo(function Fridge() {
  return (
    <group position={[7.1, 0, -11.3]}>
      <mesh geometry={geoBox} material={matFridge} scale={[0.9, 1.9, 0.75]} position={[0, 0.95, 0]} castShadow />
      <mesh geometry={geoBox} material={matFridgeDark} scale={[0.8, 0.03, 0.02]} position={[0, 1.25, 0.38]} />
      <mesh geometry={geoBox} material={matFridgeDark} scale={[0.04, 0.4, 0.04]} position={[-0.28, 0.9, 0.39]} />
    </group>
  );
});

/** Round dining table at (4.2,-7.5) with 2 mugs. */
const DiningTable = memo(function DiningTable() {
  return (
    <group position={[4.2, 0, -7.5]}>
      <mesh geometry={geoCylinder} material={matTableWood} scale={[1.6, 0.07, 1.6]} position={[0, 0.73, 0]} castShadow />
      <mesh geometry={geoCylinder} material={matTableDark} scale={[0.14, 0.7, 0.14]} position={[0, 0.36, 0]} />
      <mesh geometry={geoCylinder} material={matTableDark} scale={[0.7, 0.06, 0.7]} position={[0, 0.03, 0]} />
      <Mug position={[-0.2, 0.765, 0.15]} />
      <Mug position={[0.25, 0.765, -0.15]} />
    </group>
  );
});

export const Pantry = memo(function Pantry() {
  return (
    <group>
      <Counter />
      <Fridge />
      <DiningTable />
      {PANTRY_CHAIR_SLOTS.map((s, i) => (
        <CozyChair key={i} position={s.position} rotationY={s.rotationY} />
      ))}
    </group>
  );
});
