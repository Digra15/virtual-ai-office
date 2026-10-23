/**
 * Ruang Recovery (x -8..0.5, z -12..-4.5): 4 recovery beds from
 * RECOVERY_BEDS (long axis along Z — the 1.85 spacing only fits that
 * way), each with wooden frame + headboard + pink mattress + pillow +
 * duvet, headwall port panel on the north wall, IV stand, nightstand
 * with a live vitals monitor, and a warm lamp on the first 3 beds.
 *
 * Bed groups stay centered on RECOVERY_BEDS positions so RecoveryDirector
 * and the occupancy store keep matching the visuals.
 */
import { memo } from "react";
import * as THREE from "three";
import { RECOVERY_BEDS, type BedDef } from "../floorPlan";
import { useCozyTexture } from "../../cozy";
import { geoBox, geoCylinder, geoPlane, geoSphere } from "../../geometries";

const matWood = new THREE.MeshStandardMaterial({ color: "#8a5a33", roughness: 0.7 });
const matWoodDark = new THREE.MeshStandardMaterial({ color: "#5d3d22", roughness: 0.75 });
const matMattress = new THREE.MeshStandardMaterial({ color: "#f9a8d4", roughness: 0.9 });
const matPillow = new THREE.MeshStandardMaterial({ color: "#fdf2f8", roughness: 0.9 });
const matDuvet = new THREE.MeshStandardMaterial({ color: "#fef3e2", roughness: 0.95 });
const matPanel = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.5 });
const matPole = new THREE.MeshStandardMaterial({ color: "#9ca3af", roughness: 0.35, metalness: 0.7 });
const matBag = new THREE.MeshStandardMaterial({ color: "#bae6fd", roughness: 0.4, transparent: true, opacity: 0.85 });
const matLampWarm = new THREE.MeshStandardMaterial({
  color: "#fde68a",
  emissive: "#fbbf24",
  emissiveIntensity: 2.2,
});
const PORT_COLORS = ["#22c55e", "#f59e0b", "#ef4444"];

// ---------------------------------------------------------------------------
// Pure builder data — tested without WebGL.
// ---------------------------------------------------------------------------

export interface RecoveryBedPlan {
  id: string;
  position: [number, number, number];
  hasIV: boolean;
  hasNightstand: boolean;
  hasMonitor: boolean;
  hasLamp: boolean;
}

/** One plan per RECOVERY_BEDS entry; warm lamps on the first 3 beds. */
export function buildRecoveryBedPlans(): RecoveryBedPlan[] {
  return RECOVERY_BEDS.map((b, i) => ({
    id: b.id,
    position: b.position,
    hasIV: true,
    hasNightstand: true,
    hasMonitor: true,
    hasLamp: i < 3,
  }));
}

// ---------------------------------------------------------------------------
// Visuals
// ---------------------------------------------------------------------------

/** Headwall port panel on the north wall (z=-11.9) behind the bed. */
const HeadwallPorts = memo(function HeadwallPorts({ x }: { x: number }) {
  return (
    <group position={[x, 1.3, -11.9]}>
      <mesh geometry={geoBox} material={matPanel} scale={[0.6, 0.4, 0.06]} castShadow />
      {PORT_COLORS.map((c, i) => (
        <mesh key={c} geometry={geoSphere} scale={[0.06, 0.06, 0.06]} position={[-0.18 + i * 0.18, 0.05, 0.04]}>
          <meshBasicMaterial color={c} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
});

/** IV stand beside the bed. */
const IVStand = memo(function IVStand({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh geometry={geoCylinder} material={matPole} scale={[0.3, 0.04, 0.3]} position={[0, 0.02, 0]} />
      <mesh geometry={geoCylinder} material={matPole} scale={[0.05, 1.7, 0.05]} position={[0, 0.87, 0]} castShadow />
      <mesh geometry={geoBox} material={matBag} scale={[0.25, 0.35, 0.08]} position={[0.12, 1.5, 0]} />
    </group>
  );
});

/** One recovery bed + its bedside gear. */
const RecoveryBed = memo(function RecoveryBed({
  bed,
  index,
  vitalsTex,
}: {
  bed: BedDef;
  index: number;
  vitalsTex: THREE.CanvasTexture;
}) {
  const [bx, , bz] = bed.position;
  const nx = bx + 0.9; // nightstand x (east side)
  return (
    <group>
      <group position={[bx, 0, bz]}>
        {/* wooden frame + legs */}
        <mesh geometry={geoBox} material={matWood} scale={[1.05, 0.28, 2.1]} position={[0, 0.32, 0]} castShadow receiveShadow />
        {[
          [-0.45, -0.95],
          [0.45, -0.95],
          [-0.45, 0.95],
          [0.45, 0.95],
        ].map(([lx, lz]) => (
          <mesh key={`${lx}:${lz}`} geometry={geoBox} material={matWoodDark} scale={[0.09, 0.2, 0.09]} position={[lx, 0.1, lz]} />
        ))}
        {/* headboard at the north end */}
        <mesh geometry={geoBox} material={matWoodDark} scale={[1.05, 1.0, 0.12]} position={[0, 0.75, -0.99]} castShadow />
        {/* pink mattress + pillow + duvet */}
        <mesh geometry={geoBox} material={matMattress} scale={[0.95, 0.22, 1.95]} position={[0, 0.57, 0]} castShadow />
        <mesh geometry={geoBox} material={matPillow} scale={[0.7, 0.14, 0.5]} position={[0, 0.75, -0.68]} castShadow />
        <mesh geometry={geoBox} material={matDuvet} scale={[0.98, 0.1, 1.05]} position={[0, 0.72, 0.38]} castShadow />
      </group>
      <HeadwallPorts x={bx} />
      <IVStand position={[bx + 0.9, 0, bz + 0.6]} />
      {/* nightstand + vitals monitor */}
      <mesh geometry={geoBox} material={matWood} scale={[0.45, 0.5, 0.45]} position={[nx, 0.25, -11.3]} castShadow />
      <mesh geometry={geoCylinder} material={matPole} scale={[0.05, 0.4, 0.05]} position={[nx, 0.7, -11.3]} />
      <mesh geometry={geoBox} material={matPanel} scale={[0.52, 0.37, 0.06]} position={[nx, 1.12, -11.3]} castShadow />
      <mesh geometry={geoPlane} position={[nx, 1.12, -11.26]} scale={[0.48, 0.33, 1]}>
        <meshBasicMaterial map={vitalsTex} toneMapped={false} />
      </mesh>
      {/* warm lamp on the first 3 beds */}
      {index < 3 && (
        <group position={[nx - 0.14, 0.5, -11.18]}>
          <mesh geometry={geoCylinder} material={matWoodDark} scale={[0.1, 0.06, 0.1]} position={[0, 0.03, 0]} />
          <mesh geometry={geoSphere} material={matLampWarm} scale={[0.16, 0.16, 0.16]} position={[0, 0.16, 0]} />
        </group>
      )}
    </group>
  );
});

export const RecoveryRoom = memo(function RecoveryRoom() {
  const vitals = useCozyTexture("vitals");
  return (
    <group>
      {RECOVERY_BEDS.map((bed, i) => (
        <RecoveryBed key={bed.id} bed={bed} index={i} vitalsTex={vitals} />
      ))}
    </group>
  );
});
