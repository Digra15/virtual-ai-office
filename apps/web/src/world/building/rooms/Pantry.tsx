/**
 * Pantry (x 0.5..8, z -12..-4.5): kitchen counter + fridge along the
 * north wall, round dining table with 4 chairs + 2 mugs.
 */
import { memo } from "react";
import * as THREE from "three";
import { CozyChair, Mug } from "../../cozy";
import { geoBox, geoCircle, geoCylinder, geoSphere, geoTorus } from "../../geometries";

const matCounterBase = new THREE.MeshStandardMaterial({ color: "#6b4a2f", roughness: 0.7 });
const matCounterTop = new THREE.MeshStandardMaterial({ color: "#e8e0d2", roughness: 0.35 });
const matFridge = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.3, metalness: 0.6 });
const matFridgeDark = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.5 });
const matTableWood = new THREE.MeshStandardMaterial({ color: "#9a6a3b", roughness: 0.6 });
const matTableDark = new THREE.MeshStandardMaterial({ color: "#5d3d22", roughness: 0.7 });
const matPlate = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.3 });
const matCoffee = new THREE.MeshStandardMaterial({ color: "#4a2c1a", roughness: 0.5 });
const matDonut = new THREE.MeshStandardMaterial({ color: "#d99a4e", roughness: 0.6 });
const matFrosting = new THREE.MeshStandardMaterial({ color: "#f472b6", roughness: 0.5 });
const matRice = new THREE.MeshStandardMaterial({ color: "#fefce8", roughness: 0.8 });
const matVeggie = new THREE.MeshStandardMaterial({ color: "#4ade80", roughness: 0.7 });
const matMeat = new THREE.MeshStandardMaterial({ color: "#b45309", roughness: 0.6 });
const matRug = new THREE.MeshStandardMaterial({ color: "#e7c9a2", roughness: 0.9 });
const matShelf = new THREE.MeshStandardMaterial({ color: "#7c5a36", roughness: 0.6 });
const matJar = new THREE.MeshStandardMaterial({ color: "#d6c9a8", roughness: 0.2, transparent: true, opacity: 0.7 });
const matMachine = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.4, metalness: 0.3 });

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

/** Round dining table at (4.2,-7.5): 4 place settings (plate + food + mug,
 * one per chair) + a donut plate in the center. */
const DiningTable = memo(function DiningTable() {
  // One setting per chair, at the table edge facing that chair.
  const settings: Array<{ pos: [number, number, number]; mug: [number, number, number] }> = [
    { pos: [4.2, 0.765, -8.05], mug: [4.45, 0.765, -8.05] }, // north chair
    { pos: [4.2, 0.765, -6.95], mug: [3.95, 0.765, -6.95] }, // south chair
    { pos: [3.65, 0.765, -7.5], mug: [3.65, 0.765, -7.25] }, // west chair
    { pos: [4.75, 0.765, -7.5], mug: [4.75, 0.765, -7.75] }, // east chair
  ];
  return (
    <group position={[4.2, 0, -7.5]}>
      {/* rug under the table */}
      <mesh geometry={geoCircle} material={matRug} rotation={[-Math.PI / 2, 0, 0]} scale={[3.6, 3.6, 1]} position={[0, 0.015, 0]} receiveShadow />
      <mesh geometry={geoCylinder} material={matTableWood} scale={[1.6, 0.07, 1.6]} position={[0, 0.73, 0]} castShadow />
      <mesh geometry={geoCylinder} material={matTableDark} scale={[0.14, 0.7, 0.14]} position={[0, 0.36, 0]} />
      <mesh geometry={geoCylinder} material={matTableDark} scale={[0.7, 0.06, 0.7]} position={[0, 0.03, 0]} />
      {/* donut plate in the center */}
      <mesh geometry={geoCylinder} material={matPlate} scale={[0.5, 0.03, 0.5]} position={[0, 0.78, 0]} />
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 0.13, 0.81, Math.sin(a) * 0.13]}>
            <mesh geometry={geoTorus} material={matDonut} scale={[0.16, 0.16, 0.16]} rotation={[Math.PI / 2, 0, 0]} />
            <mesh geometry={geoTorus} material={matFrosting} scale={[0.13, 0.13, 0.13]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} />
          </group>
        );
      })}
      {/* place settings (world coords relative to table center) */}
      {settings.map((s, i) => (
        <group key={i}>
          <mesh geometry={geoCylinder} material={matPlate} scale={[0.42, 0.03, 0.42]} position={[s.pos[0] - 4.2, 0.78, s.pos[2] + 7.5]} />
          <mesh geometry={geoSphere} material={matRice} scale={[0.2, 0.08, 0.2]} position={[s.pos[0] - 4.2, 0.81, s.pos[2] + 7.5]} />
          <mesh geometry={geoSphere} material={matVeggie} scale={[0.1, 0.06, 0.1]} position={[s.pos[0] - 4.2 + 0.1, 0.81, s.pos[2] + 7.5]} />
          <mesh geometry={geoSphere} material={matMeat} scale={[0.09, 0.06, 0.09]} position={[s.pos[0] - 4.2 - 0.1, 0.81, s.pos[2] + 7.5]} />
          <Mug position={[s.mug[0] - 4.2, 0.765, s.mug[2] + 7.5]} />
        </group>
      ))}
    </group>
  );
});

/** Coffee maker on the counter + fruit bowl. */
const CounterProps = memo(function CounterProps() {
  return (
    <group position={[4.2, 0, -11.4]}>
      {/* coffee maker at the west end of the counter */}
      <group position={[-1.9, 0.91, 0]}>
        <mesh geometry={geoBox} material={matMachine} scale={[0.45, 0.5, 0.4]} position={[0, 0.25, 0]} castShadow />
        <mesh geometry={geoCylinder} material={matFridge} scale={[0.3, 0.22, 0.3]} position={[0, 0.11, 0.12]} />
        <mesh geometry={geoCylinder} material={matCoffee} scale={[0.26, 0.02, 0.26]} position={[0, 0.2, 0.12]} />
        <mesh geometry={geoBox} material={matCoffee} scale={[0.2, 0.3, 0.02]} position={[0, 0.25, 0.21]} />
      </group>
      {/* fruit bowl at the east end */}
      <group position={[1.9, 0.91, 0]}>
        <mesh geometry={geoSphere} material={matPlate} scale={[0.5, 0.18, 0.5]} position={[0, 0.05, 0]} />
        <mesh geometry={geoSphere} material={matVeggie} scale={[0.16, 0.16, 0.16]} position={[-0.1, 0.16, 0]} />
        <mesh geometry={geoSphere} material={matDonut} scale={[0.16, 0.16, 0.16]} position={[0.12, 0.16, 0.05]} />
        <mesh geometry={geoSphere} material={matFrosting} scale={[0.14, 0.14, 0.14]} position={[0, 0.18, -0.1]} />
      </group>
    </group>
  );
});

/** Wall shelf with jars + cups on the north wall. */
const WallShelf = memo(function WallShelf() {
  return (
    <group position={[4.2, 1.8, -11.85]}>
      <mesh geometry={geoBox} material={matShelf} scale={[3.2, 0.06, 0.35]} position={[0, 0, 0]} castShadow />
      {[-1.2, -0.6, 0, 0.6, 1.2].map((x, i) => (
        <group key={i} position={[x, 0.18, 0]}>
          <mesh geometry={geoCylinder} material={matJar} scale={[0.22, 0.32, 0.22]} />
          <mesh geometry={geoCylinder} material={matCoffee} scale={[0.2, 0.1, 0.2]} position={[0, 0.05, 0]} />
        </group>
      ))}
    </group>
  );
});

export const Pantry = memo(function Pantry() {
  return (
    <group>
      <Counter />
      <CounterProps />
      <WallShelf />
      <Fridge />
      <DiningTable />
      {PANTRY_CHAIR_SLOTS.map((s, i) => (
        <CozyChair key={i} position={s.position} rotationY={s.rotationY} />
      ))}
    </group>
  );
});
