/**
 * Ring road around the building + dressing (sidewalk, street lamps,
 * trees). Procedural boxes/rings only — the road itself is flat
 * geometry, so no GLB is spent on it; the GLB budget goes to the
 * vehicles (see Traffic.tsx).
 *
 * Heights: exterior ground plane sits at y=-0.26 (Exterior.tsx).
 * Road top -0.22, sidewalk top -0.20, dashes just above the road.
 * The south side is NOT rebuilt: the entrance asphalt strip + curb
 * already there serve as the south plaza.
 */
import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { geoBox, geoCylinder, geoSphere } from "../geometries";
import {
  ROAD_CENTER,
  ROAD_HALF_WIDTH,
  ROAD_TOP_Y,
  loopLength,
  loopPoint,
} from "./traffic";

const matRoad = new THREE.MeshStandardMaterial({ color: "#2f343b", roughness: 0.95 });
const matDash = new THREE.MeshStandardMaterial({ color: "#e5e7eb", roughness: 0.9 });
const matWalk = new THREE.MeshStandardMaterial({ color: "#9aa0a8", roughness: 0.9 });
const matPole = new THREE.MeshStandardMaterial({ color: "#374151", roughness: 0.5, metalness: 0.6 });
const matLampHead = new THREE.MeshStandardMaterial({ color: "#fde68a", roughness: 0.4 });
const matTrunk = new THREE.MeshStandardMaterial({ color: "#6b4a2f", roughness: 1 });
const matLeaf = new THREE.MeshStandardMaterial({ color: "#3f7a4e", roughness: 1 });

const ROAD_H = 0.04;
const WALK_H = 0.06;

/** Corner ring segments: thetaStart/thetaLength in RingGeometry angles. */
const CORNERS: { cx: number; cz: number; start: number; length: number }[] = (() => {
  const { cx, cz, halfX: hx, halfZ: hz, radius: r } = ROAD_CENTER;
  // Ring local angle θ maps (after rotation -PI/2) to world offset
  // (R cosθ, -R sinθ), so each corner's two ends pick its angles.
  return [
    { cx: cx + hx - r, cz: cz - hz + r, start: 0, length: Math.PI / 2 }, // NE
    { cx: cx + hx - r, cz: cz + hz - r, start: -Math.PI / 2, length: Math.PI / 2 }, // SE
    { cx: cx - hx + r, cz: cz + hz - r, start: Math.PI, length: Math.PI / 2 }, // SW
    { cx: cx - hx + r, cz: cz - hz + r, start: Math.PI / 2, length: Math.PI / 2 }, // NW
  ];
})();

/** Dashed center line as one InstancedMesh along the centerline loop. */
const Dashes = memo(function Dashes() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = useMemo(
    () => Math.floor(loopLength(ROAD_CENTER) / 4),
    [],
  );
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const p = loopPoint(ROAD_CENTER, i * 4 + 2);
      dummy.position.set(p.x, ROAD_TOP_Y + 0.01, p.z);
      dummy.rotation.set(0, p.heading, 0);
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

/** Street lamps + trees sampled along a loop outside the road. */
function Lamp({ x, z, inward }: { x: number; z: number; inward: number }) {
  const armX = Math.sin(inward) * 0.9;
  const armZ = Math.cos(inward) * 0.9;
  return (
    <group position={[x, -0.26, z]}>
      <mesh geometry={geoCylinder} material={matPole} scale={[0.18, 4.6, 0.18]} position={[0, 2.3, 0]} castShadow />
      {/* arm reaching toward the road + head at its end */}
      <mesh geometry={geoBox} material={matPole} scale={[0.12, 0.12, 0.9]} position={[armX / 2, 4.6, armZ / 2]} rotation={[0, inward, 0]} />
      <mesh geometry={geoBox} material={matLampHead} scale={[0.4, 0.12, 0.22]} position={[armX, 4.6, armZ]} />
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

const StreetProps = memo(function StreetProps() {
  const loop = useMemo(
    () => ({
      cx: ROAD_CENTER.cx,
      cz: ROAD_CENTER.cz,
      halfX: ROAD_CENTER.halfX + ROAD_HALF_WIDTH + 1.5,
      halfZ: ROAD_CENTER.halfZ + ROAD_HALF_WIDTH + 1.5,
      radius: ROAD_CENTER.radius + ROAD_HALF_WIDTH + 1.5,
    }),
    [],
  );
  const total = loopLength(loop);
  const lamps = useMemo(() => {
    const n = Math.floor(total / 16);
    return Array.from({ length: n }, (_, i) => {
      const p = loopPoint(loop, (i * total) / n);
      const inward = Math.atan2(ROAD_CENTER.cx - p.x, ROAD_CENTER.cz - p.z);
      return { x: p.x, z: p.z, inward, key: `lamp-${i}` };
    });
  }, [loop, total]);
  const trees = useMemo(() => {
    const n = Math.floor(total / 16);
    return Array.from({ length: n }, (_, i) => {
      const p = loopPoint(loop, ((i + 0.5) * total) / n);
      return { x: p.x, z: p.z, key: `tree-${i}` };
    });
  }, [loop, total]);
  return (
    <group>
      {lamps.map((l) => (
        <Lamp key={l.key} x={l.x} z={l.z} inward={l.inward} />
      ))}
      {trees.map((t) => (
        <Tree key={t.key} x={t.x} z={t.z} />
      ))}
    </group>
  );
});

export const Road = memo(function Road() {
  const { cx, cz, halfX: hx, halfZ: hz, radius: r } = ROAD_CENTER;
  const sx = 2 * (hx - r);
  const sz = 2 * (hz - r);
  const inner = r - ROAD_HALF_WIDTH;
  const outer = r + ROAD_HALF_WIDTH;
  return (
    <group>
      {/* straight sections */}
      <mesh geometry={geoBox} material={matRoad} scale={[sx, ROAD_H, ROAD_HALF_WIDTH * 2]} position={[cx, ROAD_TOP_Y - ROAD_H / 2, cz - hz]} receiveShadow />
      <mesh geometry={geoBox} material={matRoad} scale={[sx, ROAD_H, ROAD_HALF_WIDTH * 2]} position={[cx, ROAD_TOP_Y - ROAD_H / 2, cz + hz]} receiveShadow />
      <mesh geometry={geoBox} material={matRoad} scale={[ROAD_HALF_WIDTH * 2, ROAD_H, sz]} position={[cx + hx, ROAD_TOP_Y - ROAD_H / 2, cz]} receiveShadow />
      <mesh geometry={geoBox} material={matRoad} scale={[ROAD_HALF_WIDTH * 2, ROAD_H, sz]} position={[cx - hx, ROAD_TOP_Y - ROAD_H / 2, cz]} receiveShadow />
      {/* corner rings */}
      {CORNERS.map((c, i) => (
        <mesh
          key={i}
          geometry={new THREE.RingGeometry(inner, outer, 24, 1, c.start, c.length)}
          material={matRoad}
          position={[c.cx, ROAD_TOP_Y, c.cz]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        />
      ))}
      <Dashes />
      {/* sidewalk: north (z -15.5..-12.5) + west/east (x ±18.5..±16);
          south is the existing entrance plaza, left untouched */}
      <mesh geometry={geoBox} material={matWalk} scale={[37, WALK_H, 3]} position={[cx, ROAD_TOP_Y + 0.02, cz - hz + ROAD_HALF_WIDTH + 1.5]} receiveShadow />
      <mesh geometry={geoBox} material={matWalk} scale={[2.5, WALK_H, 23]} position={[cx - hx - 1.25, ROAD_TOP_Y + 0.02, -1]} receiveShadow />
      <mesh geometry={geoBox} material={matWalk} scale={[2.5, WALK_H, 23]} position={[cx + hx + 1.25, ROAD_TOP_Y + 0.02, -1]} receiveShadow />
      <StreetProps />
    </group>
  );
});
