import { memo, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { geoCylinder, geoSphere } from "../geometries";
import { matPlantLeaf, matPlantLeaf2, matPlantPot } from "../materials";

interface PlantProps {
  position?: [number, number, number];
  scale?: number;
}

export interface PlantSlot {
  position: [number, number, number];
  scale?: number;
}

/** Potted plant: terracotta pot + three foliage blobs. */
export const Plant = memo(function Plant({
  position = [0, 0, 0],
  scale = 1,
}: PlantProps) {
  return (
    <group position={position} scale={scale}>
      <mesh geometry={geoCylinder} material={matPlantPot} scale={[0.44, 0.36, 0.44]} position={[0, 0.18, 0]} castShadow />
      <mesh geometry={geoSphere} material={matPlantLeaf} scale={[0.62, 0.62, 0.62]} position={[0, 0.72, 0]} castShadow />
      <mesh geometry={geoSphere} material={matPlantLeaf2} scale={[0.42, 0.42, 0.42]} position={[0.2, 0.58, 0.1]} castShadow />
      <mesh geometry={geoSphere} material={matPlantLeaf} scale={[0.4, 0.4, 0.4]} position={[-0.18, 0.6, -0.08]} castShadow />
    </group>
  );
});

/** Instanced crowd version: pots + one foliage blob per plant. */
export const InstancedPlants = memo(function InstancedPlants({
  slots,
}: {
  slots: PlantSlot[];
}) {
  const pots = useRef<THREE.InstancedMesh>(null);
  const tops = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    slots.forEach((slot, i) => {
      const k = slot.scale ?? 1;
      p.set(slot.position[0], slot.position[1] + 0.18 * k, slot.position[2]);
      s.set(0.44 * k, 0.36 * k, 0.44 * k);
      m.compose(p, q, s);
      pots.current?.setMatrixAt(i, m);
      p.set(slot.position[0], slot.position[1] + 0.72 * k, slot.position[2]);
      s.set(0.62 * k, 0.62 * k, 0.62 * k);
      m.compose(p, q, s);
      tops.current?.setMatrixAt(i, m);
    });
    if (pots.current) pots.current.instanceMatrix.needsUpdate = true;
    if (tops.current) tops.current.instanceMatrix.needsUpdate = true;
  }, [slots]);

  return (
    <group>
      <instancedMesh ref={pots} args={[undefined, undefined, slots.length]} geometry={geoCylinder} material={matPlantPot} frustumCulled={false} />
      <instancedMesh ref={tops} args={[undefined, undefined, slots.length]} geometry={geoSphere} material={matPlantLeaf} frustumCulled={false} />
    </group>
  );
});
