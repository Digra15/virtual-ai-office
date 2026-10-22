import { memo } from "react";
import { geoCircle } from "../geometries";
import { matRug, matRugAccent } from "../materials";

interface RugProps {
  position?: [number, number, number];
  radius?: number;
}

/** Flat circular rug with an accent inner ring. */
export const Rug = memo(function Rug({
  position = [0, 0, 0],
  radius = 2.4,
}: RugProps) {
  return (
    <group position={position}>
      <mesh
        geometry={geoCircle}
        material={matRug}
        scale={[radius * 2, radius * 2, 1]}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, 0]}
        receiveShadow
      />
      <mesh
        geometry={geoCircle}
        material={matRugAccent}
        scale={[radius * 1.3, radius * 1.3, 1]}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.022, 0]}
        receiveShadow
      />
    </group>
  );
});
