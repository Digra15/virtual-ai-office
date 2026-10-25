/**
 * Toilets: two narrow rooms (pria x 7.8..9.8, wanita x 9.8..11.8, both
 * z -12..-4.5), each with exactly ONE sitting toilet + ONE sink inside
 * and NO stall partitions. The old 2-stall layout read as a wall of
 * partition boxes (stalls 1.9 wide in a 2m-wide room), so the partitions
 * are gone: a clearly readable toilet duduk at the north end (tank +
 * seat ring + dark opening, facing south) and a sink counter with mirror
 * mounted on the WEST wall near the door, so the door-to-toilet axis
 * down the middle of the room stays fully open.
 */
import { memo } from "react";
import * as THREE from "three";
import { geoBox, geoCylinder, geoPlane } from "../../geometries";

const matCeramic = new THREE.MeshStandardMaterial({ color: "#e8eef7", roughness: 0.3 });
const matChrome = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.25, metalness: 0.85 });
const matDark = new THREE.MeshStandardMaterial({ color: "#141a24", roughness: 0.6 });
const matOpening = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.9 });
const matMirror = new THREE.MeshStandardMaterial({
  color: "#bae6fd",
  roughness: 0.05,
  metalness: 0.9,
});

/** The two restroom units, by room id + center x (true room centers: pria 7.8..9.8, wanita 9.8..11.8). */
export const RESTROOM_UNITS = [
  { id: "toilet_pria", cx: 8.8 },
  { id: "toilet_wanita", cx: 10.8 },
] as const;

/**
 * One sitting toilet, centered on the room, tank against the north wall
 * and bowl facing south toward the door. Readable from any angle: tall
 * tank + lid + flush button at the back, pedestal bowl in front, seat
 * ring with a dark opening on top.
 */
const SittingToilet = memo(function SittingToilet({ cx }: { cx: number }) {
  return (
    <group>
      {/* tank against the north wall (wall face at z=-11.875) */}
      <mesh geometry={geoBox} material={matCeramic} scale={[0.62, 0.7, 0.22]} position={[cx, 0.55, -11.65]} castShadow />
      {/* tank lid + flush button */}
      <mesh geometry={geoBox} material={matCeramic} scale={[0.66, 0.06, 0.26]} position={[cx, 0.93, -11.65]} castShadow />
      <mesh geometry={geoCylinder} material={matChrome} scale={[0.08, 0.03, 0.08]} position={[cx, 0.975, -11.65]} />
      {/* bowl pedestal, front touching the tank */}
      <mesh geometry={geoBox} material={matCeramic} scale={[0.44, 0.38, 0.7]} position={[cx, 0.19, -11.2]} castShadow />
      {/* seat ring (oval disc) + dark opening */}
      <mesh geometry={geoCylinder} material={matCeramic} scale={[0.5, 0.07, 0.62]} position={[cx, 0.42, -11.12]} castShadow />
      <mesh geometry={geoCylinder} material={matOpening} scale={[0.3, 0.02, 0.42]} position={[cx, 0.46, -11.1]} />
    </group>
  );
});

/**
 * One sink near the door (south end), mounted flat against the WEST
 * wall: cabinet + countertop run along the wall, basin + faucet in
 * front of it, mirror on the wall facing east. Nothing stands in the
 * middle of the room, so the door-to-toilet path stays clear.
 * Wall thickness is 0.25 centered on the room boundary, so the west
 * wall's interior face is at local x -0.875 from the room center.
 * Everything here sits east of that face: cabinet back at -0.85,
 * mirror backing at -0.87..-0.82, mirror plane at -0.815.
 */
const SinkCounter = memo(function SinkCounter({ cx }: { cx: number }) {
  return (
    <group position={[cx, 0, -5.7]}>
      {/* cabinet + countertop, long side along the west wall */}
      <mesh geometry={geoBox} material={matDark} scale={[0.55, 0.8, 1.3]} position={[-0.575, 0.4, 0]} castShadow receiveShadow />
      <mesh geometry={geoBox} material={matCeramic} scale={[0.62, 0.08, 1.4]} position={[-0.575, 0.84, 0]} castShadow />
      {/* single basin + dark drain opening */}
      <mesh geometry={geoCylinder} material={matCeramic} scale={[0.42, 0.12, 0.42]} position={[-0.575, 0.92, 0]} castShadow />
      <mesh geometry={geoCylinder} material={matOpening} scale={[0.26, 0.02, 0.26]} position={[-0.575, 0.98, 0]} />
      {/* faucet: vertical stem at the wall side + spout toward the basin (east) */}
      <mesh geometry={geoCylinder} material={matChrome} scale={[0.05, 0.28, 0.05]} position={[-0.82, 1.0, 0]} />
      <mesh geometry={geoCylinder} material={matChrome} scale={[0.25, 0.04, 0.04]} position={[-0.7, 1.12, 0]} rotation={[0, 0, Math.PI / 2]} />
      {/* mirror backing + mirror on the west wall, facing east (+X) */}
      <mesh geometry={geoBox} material={matDark} scale={[0.05, 1.0, 1.2]} position={[-0.845, 1.65, 0]} />
      <mesh geometry={geoPlane} material={matMirror} scale={[1.05, 0.85, 1]} position={[-0.815, 1.65, 0]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  );
});

/** One restroom unit: 1 sitting toilet (north) + 1 sink (south), no partitions. */
const RestroomUnit = memo(function RestroomUnit({ cx }: { cx: number }) {
  return (
    <group>
      <SittingToilet cx={cx} />
      <SinkCounter cx={cx} />
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
