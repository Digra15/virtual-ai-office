import { memo } from "react";

export interface MugProps {
  /** World position of the surface point directly under the mug. */
  position: [number, number, number];
}

const COFFEE = "#3b2415";

/**
 * Coffee mug: white cylinder + dark coffee liquid disc on top +
 * a loop handle (half sunk into the body, the classic cheat).
 */
export const Mug = memo(function Mug({ position }: MugProps) {
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.045, 0.1, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.35} />
      </mesh>
      {/* coffee surface */}
      <mesh position={[0, 0.094, 0]}>
        <cylinderGeometry args={[0.041, 0.041, 0.012, 16]} />
        <meshStandardMaterial color={COFFEE} roughness={0.25} />
      </mesh>
      {/* handle */}
      <mesh position={[0.052, 0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.03, 0.009, 8, 18]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.35} />
      </mesh>
    </group>
  );
});
