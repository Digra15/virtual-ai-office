import { memo, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { geoBox, geoCylinder } from "../geometries";
import { matChairFrame, matChairSeat } from "../materials";

interface ChairProps {
  position?: [number, number, number];
  rotationY?: number;
}

export interface ChairSlot {
  position: [number, number, number];
  rotationY: number;
}

/** Single office chair: seat, tilted backrest, pole, disc base. */
export const Chair = memo(function Chair({
  position = [0, 0, 0],
  rotationY = 0,
}: ChairProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matChairSeat} scale={[0.55, 0.09, 0.55]} position={[0, 0.5, 0]} castShadow />
      <mesh
        geometry={geoBox}
        material={matChairSeat}
        scale={[0.5, 0.55, 0.08]}
        position={[0, 0.95, -0.28]}
        rotation={[-0.12, 0, 0]}
        castShadow
      />
      <mesh geometry={geoCylinder} material={matChairFrame} scale={[0.07, 0.42, 0.07]} position={[0, 0.27, 0]} />
      <mesh geometry={geoCylinder} material={matChairFrame} scale={[0.6, 0.05, 0.6]} position={[0, 0.05, 0]} />
    </group>
  );
});

/**
 * Cheap crowd version: seats, backrests, poles and bases as four
 * instancedMeshes. `frustumCulled={false}` because three.js can't derive
 * instanced bounds from the unit geometry.
 */
export const InstancedChairs = memo(function InstancedChairs({
  slots,
}: {
  slots: ChairSlot[];
}) {
  const seats = useRef<THREE.InstancedMesh>(null);
  const backs = useRef<THREE.InstancedMesh>(null);
  const poles = useRef<THREE.InstancedMesh>(null);
  const bases = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const off = new THREE.Vector3();

    const setAt = (
      mesh: THREE.InstancedMesh | null,
      i: number,
      slot: ChairSlot,
      local: [number, number, number],
      scale: [number, number, number],
      pitch = 0,
    ) => {
      if (!mesh) return;
      const [sx, sy, sz] = slot.position;
      // rotate local offset by yaw
      const c = Math.cos(slot.rotationY);
      const s = Math.sin(slot.rotationY);
      off.set(
        local[0] * c + local[2] * s,
        local[1],
        -local[0] * s + local[2] * c,
      );
      p.set(sx + off.x, sy + off.y, sz + off.z);
      e.set(pitch, slot.rotationY, 0, "YXZ");
      q.setFromEuler(e);
      m.compose(p, q, new THREE.Vector3(...scale));
      mesh.setMatrixAt(i, m);
    };

    slots.forEach((slot, i) => {
      setAt(seats.current, i, slot, [0, 0.5, 0], [0.55, 0.09, 0.55]);
      setAt(backs.current, i, slot, [0, 0.95, -0.28], [0.5, 0.55, 0.08], -0.12);
      setAt(poles.current, i, slot, [0, 0.27, 0], [0.07, 0.42, 0.07]);
      setAt(bases.current, i, slot, [0, 0.05, 0], [0.6, 0.05, 0.6]);
    });
    for (const mesh of [seats, backs, poles, bases]) {
      if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    }
  }, [slots]);

  return (
    <group>
      <instancedMesh ref={seats} args={[undefined, undefined, slots.length]} geometry={geoBox} material={matChairSeat} frustumCulled={false} />
      <instancedMesh ref={backs} args={[undefined, undefined, slots.length]} geometry={geoBox} material={matChairSeat} frustumCulled={false} />
      <instancedMesh ref={poles} args={[undefined, undefined, slots.length]} geometry={geoCylinder} material={matChairFrame} frustumCulled={false} />
      <instancedMesh ref={bases} args={[undefined, undefined, slots.length]} geometry={geoCylinder} material={matChairFrame} frustumCulled={false} />
    </group>
  );
});
