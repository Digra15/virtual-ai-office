/**
 * Ruang Meeting (x 9.5..16, z -1.8..10): conference table 2.4×5.0 with 10
 * cozy chairs from MEETING_CHAIR_SLOTS (the same slots useMeetingStore
 * seats agents on), presentation screen on the north wall, 2 mugs.
 */
import { memo } from "react";
import * as THREE from "three";
import { MEETING_CHAIR_SLOTS } from "../../rooms/MeetingRoom";
import { GamingChair, Mug, useCozyTexture } from "../../cozy";
import { geoBox, geoPlane } from "../../geometries";

const matTableWood = new THREE.MeshStandardMaterial({ color: "#9a6a3b", roughness: 0.6 });
const matTableLeg = new THREE.MeshStandardMaterial({ color: "#2b323e", roughness: 0.5, metalness: 0.5 });
const matScreenFrame = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.5 });

/** Conference table 2.4 (x) × 5.0 (z) at (12.8,4.4). */
const ConferenceTable = memo(function ConferenceTable() {
  return (
    <group position={[12.8, 0, 4.4]}>
      <mesh geometry={geoBox} material={matTableWood} scale={[2.4, 0.08, 5.0]} position={[0, 0.73, 0]} castShadow receiveShadow />
      {[
        [-1.0, -2.3],
        [1.0, -2.3],
        [-1.0, 2.3],
        [1.0, 2.3],
      ].map(([lx, lz]) => (
        <mesh key={`${lx}:${lz}`} geometry={geoBox} material={matTableLeg} scale={[0.1, 0.73, 0.1]} position={[lx, 0.365, lz]} />
      ))}
      {/* mugs on the table */}
      <Mug position={[-0.4, 0.77, -0.4]} />
      <Mug position={[0.4, 0.77, 0.4]} />
    </group>
  );
});

/** Presentation screen on the north wall (z=-1.8), facing +Z into the room.
 * The chart is decorative: hardcoded illustrative bars, NOT live metrics.
 * Labeled as such on the screen itself (subtitle) so it can never be
 * read as real analytics. Feeding real data was disproportionate for a
 * wall decoration; the honest label is the fix. */
const PresentationScreen = memo(function PresentationScreen() {
  const tex = useCozyTexture("presentation", {
    title: "DIFIA AI ANALYTICS",
    subtitle: "data ilustrasi · bukan metrik live",
    barColor: "#0284c7",
  });
  return (
    <group position={[12.8, 1.8, -1.65]}>
      <mesh geometry={geoBox} material={matScreenFrame} scale={[4.4, 2.5, 0.1]} castShadow />
      <mesh geometry={geoPlane} position={[0, 0, 0.06]} scale={[4.2, 2.3, 1]}>
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
});

export const MeetingRoom = memo(function MeetingRoom() {
  return (
    <group>
      <ConferenceTable />
      <PresentationScreen />
      {MEETING_CHAIR_SLOTS.map((s, i) => (
        <GamingChair
          key={i}
          position={s.position}
          rotationY={s.rotationY}
          // head chairs (the two along the table's short axis) get the pink stripe
          pinkStripe={s.position[0] === 12.8}
        />
      ))}
    </group>
  );
});
