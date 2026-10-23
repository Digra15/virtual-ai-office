/**
 * Toilets: two narrow rooms (pria x 8..10, wanita x 10..12, both
 * z -12..-4.5). The old RestroomSet (3.4 wide) does not fit a 2m-wide
 * room, so each room gets minimal boxes instead: 2 compact stalls along
 * the north end + a sink counter with mirror near the door.
 */
import { memo } from "react";
import * as THREE from "three";
import { geoBox, geoCylinder, geoPlane } from "../../geometries";

const matPartition = new THREE.MeshStandardMaterial({ color: "#3b4a66", roughness: 0.8 });
const matCeramic = new THREE.MeshStandardMaterial({ color: "#e8eef7", roughness: 0.3 });
const matChrome = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.25, metalness: 0.85 });
const matDark = new THREE.MeshStandardMaterial({ color: "#141a24", roughness: 0.6 });
const matMirror = new THREE.MeshStandardMaterial({
  color: "#bae6fd",
  roughness: 0.05,
  metalness: 0.9,
});

/** The two restroom units, by room id + center x. */
export const RESTROOM_UNITS = [
  { id: "toilet_pria", cx: 9 },
  { id: "toilet_wanita", cx: 11 },
] as const;

/** One compact stall: 1.9 wide × 1.6 deep, door front facing +Z. */
const Stall = memo(function Stall({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* side dividers */}
      {[-0.92, 0.92].map((dx) => (
        <mesh key={dx} geometry={geoBox} material={matPartition} scale={[0.06, 2.0, 1.6]} position={[dx, 1.0, 0]} castShadow />
      ))}
      {/* back wall */}
      <mesh geometry={geoBox} material={matPartition} scale={[1.9, 2.0, 0.06]} position={[0, 1.0, -0.77]} />
      {/* door (ajar) */}
      <mesh geometry={geoBox} material={matPartition} scale={[1.7, 1.9, 0.05]} position={[0, 0.98, 0.8]} castShadow />
      {/* toilet: tank + bowl */}
      <mesh geometry={geoBox} material={matCeramic} scale={[0.5, 0.55, 0.2]} position={[0, 0.65, -0.6]} castShadow />
      <mesh geometry={geoBox} material={matCeramic} scale={[0.45, 0.4, 0.6]} position={[0, 0.28, -0.25]} castShadow />
    </group>
  );
});

/** Sink counter + mirror near the south end. */
const SinkCounter = memo(function SinkCounter({ x }: { x: number }) {
  return (
    <group position={[x, 0, -5.6]}>
      <mesh geometry={geoBox} material={matDark} scale={[1.8, 0.8, 0.55]} position={[0, 0.4, 0]} castShadow receiveShadow />
      <mesh geometry={geoBox} material={matCeramic} scale={[1.9, 0.08, 0.62]} position={[0, 0.84, 0]} castShadow />
      {[-0.45, 0.45].map((sx) => (
        <group key={sx} position={[sx, 0, 0]}>
          <mesh geometry={geoCylinder} material={matCeramic} scale={[0.5, 0.14, 0.5]} position={[0, 0.93, 0]} />
          <mesh geometry={geoCylinder} material={matChrome} scale={[0.05, 0.2, 0.05]} position={[0, 1.02, -0.15]} />
        </group>
      ))}
      {/* mirror on a slim backing, faces +Z toward the user */}
      <mesh geometry={geoBox} material={matDark} scale={[1.9, 1.1, 0.05]} position={[0, 1.65, -0.32]} />
      <mesh geometry={geoPlane} material={matMirror} scale={[1.7, 0.9, 1]} position={[0, 1.65, -0.29]} />
    </group>
  );
});

/** One restroom unit: 2 stalls + sink counter. */
const RestroomUnit = memo(function RestroomUnit({ cx }: { cx: number }) {
  return (
    <group>
      <Stall position={[cx, 0, -11.0]} />
      <Stall position={[cx, 0, -9.2]} />
      <SinkCounter x={cx} />
    </group>
  );
});

export const Restrooms = memo(function Restrooms() {
  return (
    <group>
      {RESTROOM_UNITS.map((u) => (
        <RestroomUnit key={u.id} cx={u.cx} />
      ))}
    </group>
  );
});
