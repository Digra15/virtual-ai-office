import { memo } from "react";
import * as THREE from "three";
import { geoBox, geoCylinder, geoPlane } from "../geometries";
import { Signage } from "./Signage";

interface FurnitureProps {
  position?: [number, number, number];
  rotationY?: number;
}

const matPartition = new THREE.MeshStandardMaterial({ color: "#3b4a66", roughness: 0.8 });
const matCeramic = new THREE.MeshStandardMaterial({ color: "#e8eef7", roughness: 0.3 });
const matChrome = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.25, metalness: 0.85 });
const matDark = new THREE.MeshStandardMaterial({ color: "#141a24", roughness: 0.6 });
const matMirror = new THREE.MeshStandardMaterial({
  color: "#bae6fd",
  roughness: 0.05,
  metalness: 0.9,
  side: THREE.DoubleSide,
});

/** One toilet stall: partitions + door + simple toilet. */
const Stall = memo(function Stall({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      {/* side partitions */}
      {[-0.75, 0.75].map((dx) => (
        <mesh
          key={dx}
          geometry={geoBox}
          material={matPartition}
          scale={[0.06, 2.0, 1.7]}
          position={[dx, 1.0, 0]}
          castShadow
        />
      ))}
      {/* back wall */}
      <mesh geometry={geoBox} material={matPartition} scale={[1.56, 2.0, 0.06]} position={[0, 1.0, -0.85]} />
      {/* door (slightly ajar gap) */}
      <mesh geometry={geoBox} material={matPartition} scale={[1.4, 1.9, 0.05]} position={[0, 0.98, 0.85]} castShadow />
      {/* toilet: tank + bowl */}
      <mesh geometry={geoBox} material={matCeramic} scale={[0.5, 0.55, 0.2]} position={[0, 0.65, -0.65]} castShadow />
      <mesh geometry={geoBox} material={matCeramic} scale={[0.45, 0.4, 0.6]} position={[0, 0.28, -0.3]} castShadow />
      <mesh geometry={geoBox} material={matCeramic} scale={[0.5, 0.08, 0.65]} position={[0, 0.52, -0.3]} />
    </group>
  );
});

/** Restroom set: two toilet stalls, sink counter with basins, mirror, WC sign. */
export const RestroomSet = memo(function RestroomSet({
  position = [0, 0, 0],
  rotationY = 0,
}: FurnitureProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Stall x={-1.1} />
      <Stall x={0.65} />
      {/* sink counter */}
      <mesh geometry={geoBox} material={matDark} scale={[2.6, 0.8, 0.6]} position={[0, 0.4, 2.2]} castShadow receiveShadow />
      <mesh geometry={geoBox} material={matCeramic} scale={[2.7, 0.08, 0.7]} position={[0, 0.84, 2.2]} castShadow />
      {[-0.7, 0.7].map((x) => (
        <group key={x} position={[x, 0, 2.2]}>
          <mesh geometry={geoBox} material={matCeramic} scale={[0.5, 0.16, 0.4]} position={[0, 0.95, 0]} />
          <mesh geometry={geoCylinder} material={matChrome} scale={[0.06, 0.22, 0.06]} position={[0, 1.05, -0.14]} />
          <mesh geometry={geoCylinder} material={matChrome} scale={[0.05, 0.16, 0.05]} position={[0, 1.14, -0.08]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
      {/* mirror */}
      <mesh geometry={geoPlane} material={matMirror} scale={[2.4, 1.0, 1]} position={[0, 1.7, 2.52]} rotation={[0, Math.PI, 0]} />
      <mesh geometry={geoBox} material={matDark} scale={[2.5, 1.1, 0.04]} position={[0, 1.7, 2.55]} />
      {/* wall sign */}
      <Signage position={[0, 2.6, 2.56]} rotationY={Math.PI} text="WC" scale={0.8} />
    </group>
  );
});
