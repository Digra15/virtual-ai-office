/**
 * Resepsionis (lobby, x -6.5..9.5, z 6..10): welcome counter with emissive
 * DIFIA logo, receptionist chair, pink waiting sofa + coffee table with
 * mugs, plants.
 */
import { memo } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { CozyChair, CozyPlant, Mug, useCozyTexture } from "../../cozy";
import { geoBox, geoCylinder, geoPlane } from "../../geometries";

const matCounterWhite = new THREE.MeshStandardMaterial({ color: "#faf8f4", roughness: 0.4 });
const matCounterTrim = new THREE.MeshStandardMaterial({ color: "#f472b6", roughness: 0.5 });
const matSofaPink = new THREE.MeshStandardMaterial({ color: "#f9a8d4", roughness: 0.9 });
const matPillowA = new THREE.MeshStandardMaterial({ color: "#fdf2f8", roughness: 0.9 });
const matPillowB = new THREE.MeshStandardMaterial({ color: "#fbcfe8", roughness: 0.9 });
const matTableWood = new THREE.MeshStandardMaterial({ color: "#8a5a33", roughness: 0.6 });
const matTableDark = new THREE.MeshStandardMaterial({ color: "#5d3d22", roughness: 0.7 });

/** Welcome counter at (0,7.4): white 3.8×1.05×1.1 with pink trim. */
const Counter = memo(function Counter() {
  return (
    <group position={[0, 0, 7.4]}>
      <mesh geometry={geoBox} material={matCounterWhite} scale={[3.8, 1.0, 1.1]} position={[0, 0.5, 0]} castShadow receiveShadow />
      <mesh geometry={geoBox} material={matCounterTrim} scale={[3.82, 0.08, 1.12]} position={[0, 0.96, 0]} />
      <mesh geometry={geoBox} material={matTableWood} scale={[4.0, 0.07, 1.3]} position={[0, 1.04, 0]} castShadow />
    </group>
  );
});

/** Emissive DIFIA logo on the counter's south face. */
const CounterLogo = memo(function CounterLogo() {
  const logo = useCozyTexture("logo");
  return (
    <mesh geometry={geoPlane} position={[0, 0.55, 7.96]} scale={[2.2, 0.55, 1]}>
      <meshBasicMaterial map={logo} transparent toneMapped={false} />
    </mesh>
  );
});

/** Pink two-seat sofa + 2 pillows at (6.5,6.5), facing south (+Z) toward the coffee table (per the user's builder code). */
const Sofa = memo(function Sofa() {
  return (
    <group position={[6.5, 0, 6.5]}>
      <RoundedBox args={[2.0, 0.42, 0.9]} radius={0.1} smoothness={4} position={[0, 0.35, 0]} castShadow>
        <meshStandardMaterial color={matSofaPink.color} roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[2.0, 0.75, 0.28]} radius={0.1} smoothness={4} position={[0, 0.72, -0.42]} castShadow>
        <meshStandardMaterial color={matSofaPink.color} roughness={0.9} />
      </RoundedBox>
      {[-1.0, 1.0].map((x) => (
        <RoundedBox key={x} args={[0.24, 0.55, 0.9]} radius={0.08} smoothness={4} position={[x, 0.5, 0]} castShadow>
          <meshStandardMaterial color={matSofaPink.color} roughness={0.9} />
        </RoundedBox>
      ))}
      <RoundedBox args={[0.42, 0.42, 0.16]} radius={0.08} smoothness={4} position={[-0.5, 0.72, -0.28]} rotation={[0, 0, 0.15]}>
        <meshStandardMaterial color={matPillowA.color} roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[0.42, 0.42, 0.16]} radius={0.08} smoothness={4} position={[0.5, 0.72, -0.28]} rotation={[0, 0, -0.12]}>
        <meshStandardMaterial color={matPillowB.color} roughness={0.9} />
      </RoundedBox>
    </group>
  );
});

/** Round coffee table at (6.5,8.2) with two mugs. */
const CoffeeTable = memo(function CoffeeTable() {
  return (
    <group position={[6.5, 0, 8.2]}>
      <mesh geometry={geoCylinder} material={matTableWood} scale={[1.1, 0.07, 1.1]} position={[0, 0.42, 0]} castShadow />
      <mesh geometry={geoCylinder} material={matTableDark} scale={[0.12, 0.4, 0.12]} position={[0, 0.2, 0]} />
      <mesh geometry={geoCylinder} material={matTableDark} scale={[0.5, 0.05, 0.5]} position={[0, 0.025, 0]} />
      <Mug position={[-0.25, 0.455, 0.1]} />
      <Mug position={[0.28, 0.455, -0.12]} />
    </group>
  );
});

export const Reception = memo(function Reception() {
  return (
    <group>
      <Counter />
      <CounterLogo />
      {/* receptionist chair behind the counter, faces the visitors */}
      <CozyChair position={[0, 0, 6.7]} rotationY={0} pinkStripe />
      {/* flanking plants */}
      <CozyPlant position={[-2.4, 0, 7.4]} />
      <CozyPlant position={[2.4, 0, 7.4]} />
      {/* waiting area */}
      <Sofa />
      <CoffeeTable />
      <CozyPlant position={[8.6, 0, 6.5]} scale={1.2} />
    </group>
  );
});
