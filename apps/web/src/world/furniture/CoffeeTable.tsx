import { memo } from "react";
import { geoBox } from "../geometries";
import { matDeskLeg, matDeskTop } from "../materials";

interface CoffeeTableProps {
  position?: [number, number, number];
  rotationY?: number;
}

/** Low lounge table. */
export const CoffeeTable = memo(function CoffeeTable({
  position = [0, 0, 0],
  rotationY = 0,
}: CoffeeTableProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matDeskTop} scale={[1.4, 0.07, 0.7]} position={[0, 0.4, 0]} castShadow receiveShadow />
      {[
        [-0.6, -0.27],
        [0.6, -0.27],
        [-0.6, 0.27],
        [0.6, 0.27],
      ].map(([x, z]) => (
        <mesh
          key={`${x}:${z}`}
          geometry={geoBox}
          material={matDeskLeg}
          scale={[0.06, 0.37, 0.06]}
          position={[x, 0.185, z]}
        />
      ))}
    </group>
  );
});
