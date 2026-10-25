/**
 * Straight road in front of the office + dressing (sidewalk on the
 * far side, street lamps, trees). Procedural boxes only — the road
 * itself is flat geometry, so no GLB is spent on it; the GLB budget
 * goes to the vehicles (see Traffic.tsx).
 *
 * Heights: exterior ground plane sits at y=-0.26 (Exterior.tsx).
 * Road top -0.22, sidewalk top -0.20, dashes just above the road.
 * The entrance asphalt strip + curb + plaza already there are left
 * untouched; the road clears them by 0.5 m (strip ends z=24, road
 * starts z=24.5).
 */
import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { geoBox, geoCylinder, geoSphere } from "../geometries";
import { ROAD_LENGTH, ROAD_LINE, ROAD_TOP_Y } from "./traffic";

const matRoad = new THREE.MeshStandardMaterial({ color: "#2f343b", roughness: 0.95 });
const matDash = new THREE.MeshStandardMaterial({ color: "#e5e7eb", roughness: 0.9 });
const matWalk = new THREE.MeshStandardMaterial({ color: "#9aa0a8", roughness: 0.9 });
const matPole = new THREE.MeshStandardMaterial({ color: "#374151", roughness: 0.5, metalness: 0.6 });
const matLampHead = new THREE.MeshStandardMaterial({ color: "#fde68a", roughness: 0.4 });
const matTrunk = new THREE.MeshStandardMaterial({ color: "#6b4a2f", roughness: 1 });
const matLeaf = new THREE.MeshStandardMaterial({ color: "#3f7a4e", roughness: 1 });

const ROAD_H = 0.04;
const WALK_H = 0.06;

/** Dashed center line as one InstancedMesh along the road. */
const Dashes = memo(function Dashes() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = useMemo(() => Math.floor(ROAD_LENGTH / 4), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      dummy.position.set(ROAD_LINE.xMin + i * 4 + 2, ROAD_TOP_Y + 0.01, ROAD_LINE.centerZ);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [count]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, count]}
      geometry={geoBox}
      material={matDash}
      scale={[0.18, 0.02, 2.2]}
    />
  );
});

/** Street lamp: pole + arm reaching toward the road + head. */
function Lamp({ x, z }: { x: number; z: number }) {
  // South-side lamps: the road is to the north (-z).
  return (
    <group position={[x, -0.26, z]}>
      <mesh geometry={geoCylinder} material={matPole} scale={[0.18, 4.6, 0.18]} position={[0, 2.3, 0]} castShadow />
      <mesh geometry={geoBox} material={matPole} scale={[0.12, 0.12, 0.9]} position={[0, 4.6, -0.45]} />
      <mesh geometry={geoBox} material={matLampHead} scale={[0.4, 0.12, 0.22]} position={[0, 4.6, -0.9]} />
    </group>
  );
}

function Tree({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, -0.26, z]}>
      <mesh geometry={geoCylinder} material={matTrunk} scale={[0.36, 1.4, 0.36]} position={[0, 0.7, 0]} castShadow />
      <mesh geometry={geoSphere} material={matLeaf} scale={[2.2, 2.2, 2.2]} position={[0, 2.1, 0]} castShadow />
      <mesh geometry={geoSphere} material={matLeaf} scale={[1.5, 1.5, 1.5]} position={[0, 3.1, 0]} castShadow />
    </group>
  );
}

export const Road = memo(function Road() {
  const { xMin, xMax, centerZ, halfWidth } = ROAD_LINE;
  const length = xMax - xMin;
  const lamps = useMemo(
    () => Array.from({ length: 10 }, (_, i) => ({ x: -63 + i * 14, key: `lamp-${i}` })),
    [],
  );
  const trees = useMemo(
    () => Array.from({ length: 10 }, (_, i) => ({ x: -56 + i * 14, key: `tree-${i}` })),
    [],
  );
  return (
    <group>
      {/* road surface: x -70..70, z 24.5..31.5 */}
      <mesh geometry={geoBox} material={matRoad} scale={[length, ROAD_H, halfWidth * 2]} position={[(xMin + xMax) / 2, ROAD_TOP_Y - ROAD_H / 2, centerZ]} receiveShadow />
      <Dashes />
      {/* sidewalk on the far side: z 31.5..34 */}
      <mesh geometry={geoBox} material={matWalk} scale={[length, WALK_H, 2.5]} position={[(xMin + xMax) / 2, ROAD_TOP_Y + 0.02, centerZ + halfWidth + 1.25]} receiveShadow />
      {/* lamps + trees along the far sidewalk */}
      {lamps.map((l) => (
        <Lamp key={l.key} x={l.x} z={centerZ + halfWidth + 1.5} />
      ))}
      {trees.map((t) => (
        <Tree key={t.key} x={t.x} z={centerZ + halfWidth + 1.5} />
      ))}
    </group>
  );
});
