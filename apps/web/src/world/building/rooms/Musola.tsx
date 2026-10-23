/**
 * Musola (x -16..-8, z -12..-4.5): gold mihrab arch on the north wall,
 * 6 prayer rugs (prayerRug texture) in 3 columns × 2 rows, a plant, and
 * an "ARAH KIBLAT" plaque on the north wall. Prayer outfits are handled
 * by the character system — this file only builds the room.
 */
import { memo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { CozyPlant, useCozyTexture } from "../../cozy";
import { geoBox, geoCylinder, geoPlane } from "../../geometries";

const matGold = new THREE.MeshStandardMaterial({
  color: "#d4af37",
  roughness: 0.35,
  metalness: 0.6,
  emissive: "#8a6d1f",
  emissiveIntensity: 0.25,
});
const matArchDark = new THREE.MeshStandardMaterial({ color: "#3f3a2e", roughness: 0.7 });
const matPlaqueBg = new THREE.MeshStandardMaterial({ color: "#1c1917", roughness: 0.6 });

/** Prayer rug positions: 3 columns (x) × 2 rows (z). */
export const PRAYER_RUG_POSITIONS: Array<[number, number]> = [
  [-13.2, -9.5],
  [-11.6, -9.5],
  [-10.0, -9.5],
  [-13.2, -7.3],
  [-11.6, -7.3],
  [-10.0, -7.3],
];

/** Gold mihrab arch at (-11.5,-11.8): two pillars + half-torus arch. */
const Mihrab = memo(function Mihrab() {
  return (
    <group position={[-11.5, 0, -11.8]}>
      {[-1.1, 1.1].map((x) => (
        <group key={x}>
          <mesh geometry={geoCylinder} material={matGold} scale={[0.22, 2.2, 0.22]} position={[x, 1.1, 0]} castShadow />
          <mesh geometry={geoBox} material={matArchDark} scale={[0.34, 0.1, 0.34]} position={[x, 0.05, 0]} />
        </group>
      ))}
      {/* half-torus arch spanning the pillars */}
      <mesh position={[0, 2.2, 0]} castShadow>
        <torusGeometry args={[1.1, 0.1, 10, 32, Math.PI]} />
        <meshStandardMaterial
          color={matGold.color}
          roughness={0.35}
          metalness={0.6}
          emissive={matGold.emissive}
          emissiveIntensity={0.25}
        />
      </mesh>
      {/* inner glow panel */}
      <mesh geometry={geoPlane} position={[0, 1.5, -0.05]} scale={[1.9, 2.6, 1]}>
        <meshBasicMaterial color="#fde68a" transparent opacity={0.25} />
      </mesh>
    </group>
  );
});

/** "ARAH KIBLAT" plaque on the north wall (z=-12), facing +Z into the room. */
const QiblaPlaque = memo(function QiblaPlaque() {
  return (
    <group position={[-12.5, 1.9, -11.86]}>
      <mesh geometry={geoBox} material={matPlaqueBg} scale={[2.4, 0.7, 0.08]} castShadow />
      <Text position={[0, 0.1, 0.05]} fontSize={0.28} color="#e8c468" anchorX="center" anchorY="middle">
        ARAH KIBLAT
      </Text>
      <Text position={[0, -0.2, 0.05]} fontSize={0.18} color="#a8a29e" anchorX="center" anchorY="middle">
        ▲ menghadap mihrab
      </Text>
    </group>
  );
});

export const Musola = memo(function Musola() {
  const rugTex = useCozyTexture("prayerRug");
  return (
    <group>
      <Mihrab />
      <QiblaPlaque />
      {PRAYER_RUG_POSITIONS.map(([x, z], i) => (
        <mesh key={i} geometry={geoBox} position={[x, 0.02, z]} scale={[1.15, 0.04, 0.7]} receiveShadow>
          <meshStandardMaterial map={rugTex} roughness={0.95} />
        </mesh>
      ))}
      <CozyPlant position={[-15.3, 0, -11.0]} />
    </group>
  );
});
