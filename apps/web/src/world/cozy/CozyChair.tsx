import { memo } from "react";
import { RoundedBox } from "@react-three/drei";

export interface CozyChairProps {
  /** World position of the chair base. */
  position?: [number, number, number];
  /**
   * Yaw. FACING CONVENTION (matches the user's builder): the backrest sits
   * at local -Z and the chair faces local +Z.
   *   rotationY = 0        → faces +Z (south)
   *   rotationY = Math.PI  → faces -Z (north)
   *   rotationY = Math.PI/2 → faces +X (east)
   *   rotationY = -Math.PI/2 → faces -X (west)
   */
  rotationY?: number;
  /** Cushion color. */
  color?: string | number;
  /** Pink DIFIA stripe across the backrest. */
  pinkStripe?: boolean;
}

export const COZY_CHAIR_PINK = "#f472b6";
const FRAME = "#232a35";

/**
 * World-space facing unit vector (x, z) for a chair yaw.
 * rotationY=0 → [0, 1] (+Z). Pure — used by tests and by room code that
 * needs to know which way a chair looks without mounting it.
 */
export function chairFacing(rotationY: number): [number, number] {
  return [Math.sin(rotationY), Math.cos(rotationY)];
}

/**
 * Cozy office chair: puffy rounded cushions, 5-star caster base, gas-lift
 * stem, curved two-segment backrest at local -Z, padded armrests.
 * Faces local +Z at rotationY=0.
 */
export const CozyChair = memo(function CozyChair({
  position = [0, 0, 0],
  rotationY = 0,
  color = "#7c8aa0",
  pinkStripe = false,
}: CozyChairProps) {
  const legs = [0, 1, 2, 3, 4];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 5-star caster base: five small boxes rotated around the hub */}
      <mesh position={[0, 0.07, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.09, 12]} />
        <meshStandardMaterial color={FRAME} roughness={0.4} metalness={0.6} />
      </mesh>
      {legs.map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, -a, 0]}>
            <mesh position={[0.17, 0.045, 0]} castShadow>
              <boxGeometry args={[0.3, 0.05, 0.07]} />
              <meshStandardMaterial color={FRAME} roughness={0.4} metalness={0.6} />
            </mesh>
            {/* caster wheel */}
            <mesh position={[0.31, 0.035, 0]} castShadow>
              <sphereGeometry args={[0.035, 10, 10]} />
              <meshStandardMaterial color="#11151c" roughness={0.6} />
            </mesh>
          </group>
        );
      })}

      {/* gas-lift stem */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.38, 12]} />
        <meshStandardMaterial color={FRAME} roughness={0.35} metalness={0.7} />
      </mesh>

      {/* seat cushion */}
      <RoundedBox args={[0.56, 0.14, 0.54]} radius={0.06} smoothness={4} position={[0, 0.52, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.9} />
      </RoundedBox>

      {/* curved backrest: two tilted segments, back at local -Z */}
      <RoundedBox
        args={[0.5, 0.36, 0.12]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.86, -0.3]}
        rotation={[-0.06, 0, 0]}
        castShadow
      >
        <meshStandardMaterial color={color} roughness={0.9} />
      </RoundedBox>
      <RoundedBox
        args={[0.48, 0.34, 0.11]}
        radius={0.05}
        smoothness={4}
        position={[0, 1.16, -0.335]}
        rotation={[-0.18, 0, 0]}
        castShadow
      >
        <meshStandardMaterial color={color} roughness={0.9} />
      </RoundedBox>

      {/* optional pink DIFIA stripe on the upper backrest */}
      {pinkStripe && (
        <RoundedBox
          args={[0.34, 0.09, 0.02]}
          radius={0.008}
          smoothness={4}
          position={[0, 1.18, -0.272]}
          rotation={[-0.18, 0, 0]}
        >
          <meshStandardMaterial color={COZY_CHAIR_PINK} roughness={0.7} />
        </RoundedBox>
      )}

      {/* padded armrests */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.3, 0.68, 0.02]} castShadow>
            <boxGeometry args={[0.05, 0.22, 0.05]} />
            <meshStandardMaterial color={FRAME} roughness={0.4} metalness={0.6} />
          </mesh>
          <RoundedBox args={[0.09, 0.06, 0.36]} radius={0.028} smoothness={4} position={[s * 0.3, 0.81, 0.02]} castShadow>
            <meshStandardMaterial color={color} roughness={0.9} />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
});
