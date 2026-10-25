/**
 * Resepsionis (lobby, x -6.5..9.5, z 6..10): welcome counter with emissive
 * DIFIA logo, receptionist chair, Kenney low-poly waiting sofa + coffee
 * table with mugs, plants.
 */
import { memo } from "react";
import * as THREE from "three";
import { CozyPlant, GamingChair, Mug, useCozyTexture } from "../../cozy";
import { geoBox, geoPlane } from "../../geometries";
import { PolyModel } from "../../PolyModel";

const matCounterWhite = new THREE.MeshStandardMaterial({ color: "#faf8f4", roughness: 0.4 });
const matCounterTrim = new THREE.MeshStandardMaterial({ color: "#f472b6", roughness: 0.5 });
const matTableWood = new THREE.MeshStandardMaterial({ color: "#8a5a33", roughness: 0.6 });

/** Welcome counter at (-4,7.4): white 3.8×1.05×1.1 with pink trim.
 * Sits on the lobby's west side so the entrance axis (x=0) stays clear
 * — the old center position blocked the aisle→lobby→entrance path. */
const Counter = memo(function Counter() {
  return (
    <group position={[-4, 0, 7.4]}>
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
    <mesh geometry={geoPlane} position={[-4, 0.55, 7.96]} scale={[2.2, 0.55, 1]}>
      <meshBasicMaterial map={logo} transparent toneMapped={false} />
    </mesh>
  );
});

/** Kenney low-poly sofa at (6.5,6.5), facing south (+Z) toward the coffee
 * table. Raw GLB is 0.98 wide, so scale 2.0 gives a 1.96 m two-seater —
 * the same footprint as the old procedural sofa, with a real back,
 * arms, cushions and legs (pink/beige, matching the lobby's pink
 * accents). Its backrest sits on the -z side, so rotationY 0 already
 * faces it south. The lobby-sofa wander spot (6.5,6.5, facing 0) is
 * unchanged: the sitting agent sinks onto the seat like before. */
const Sofa = memo(function Sofa() {
  return (
    <PolyModel
      file="lounge-sofa.glb"
      folder="kenney"
      position={[6.5, 0, 6.5]}
      scale={2.0}
    />
  );
});

/** Kenney low-poly coffee table at (6.5,8.2) with two mugs. Raw GLB is
 * 0.66 long x 0.23 high, so scale 1.7 gives a 1.12 m table with its top
 * at 0.39 — the mugs sit on that top surface. */
const CoffeeTable = memo(function CoffeeTable() {
  return (
    <group position={[6.5, 0, 8.2]}>
      <PolyModel
        file="table-coffee.glb"
        folder="kenney"
        position={[0, 0, 0]}
        scale={1.7}
      />
      <Mug position={[-0.25, 0.39, 0.1]} />
      <Mug position={[0.28, 0.39, -0.12]} />
    </group>
  );
});

export const Reception = memo(function Reception() {
  return (
    <group>
      <Counter />
      <CounterLogo />
      {/* receptionist chair behind the counter, faces the visitors */}
      <GamingChair position={[-4, 0, 6.7]} rotationY={0} pinkStripe />
      {/* flanking plants (west plant flanks the counter's east end — the
          gap between the counter's west edge and the wall fits no pot) */}
      <CozyPlant position={[-1.6, 0, 7.4]} />
      <CozyPlant position={[2.4, 0, 7.4]} />
      {/* waiting area */}
      <Sofa />
      <CoffeeTable />
      <CozyPlant position={[8.6, 0, 6.5]} scale={1.2} />
    </group>
  );
});
