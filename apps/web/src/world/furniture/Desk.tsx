import { memo } from "react";
import { geoBox } from "../geometries";
import { matDeskLeg, matDeskTop } from "../materials";

interface DeskProps {
  position?: [number, number, number];
  rotationY?: number;
}

/** Simple workstation desk: top slab + four legs. */
export const Desk = memo(function Desk({
  position = [0, 0, 0],
  rotationY = 0,
}: DeskProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* top */}
      <mesh geometry={geoBox} material={matDeskTop} scale={[2.2, 0.08, 1.1]} position={[0, 0.75, 0]} castShadow receiveShadow />
      {/* legs */}
      {[
        [-1.0, -0.45],
        [1.0, -0.45],
        [-1.0, 0.45],
        [1.0, 0.45],
      ].map(([x, z]) => (
        <mesh
          key={`${x}:${z}`}
          geometry={geoBox}
          material={matDeskLeg}
          scale={[0.07, 0.71, 0.07]}
          position={[x, 0.355, z]}
          castShadow
        />
      ))}
      {/* modesty panel */}
      <mesh geometry={geoBox} material={matDeskLeg} scale={[2.0, 0.35, 0.04]} position={[0, 0.5, -0.5]} />
    </group>
  );
});
