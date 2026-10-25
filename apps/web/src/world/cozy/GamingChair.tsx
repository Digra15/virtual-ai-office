import { memo } from "react";
import { RoundedBox } from "@react-three/drei";
import { COZY_CHAIR_PINK } from "./CozyChair";

export interface GamingChairProps {
  /** World position of the chair base. */
  position?: [number, number, number];
  /**
   * Yaw, same convention as CozyChair: the backrest sits at local -Z
   * and the chair faces local +Z.
   *   rotationY = 0        → faces +Z (south)
   *   rotationY = Math.PI  → faces -Z (north)
   */
  rotationY?: number;
  /** Main body color (default dark racing charcoal). */
  color?: string | number;
  /** Pink DIFIA headrest + lumbar pillows. */
  pinkStripe?: boolean;
}

const FRAME = "#232a35";
const BODY = "#1f2937";

/** Seat cushion center height — kept equal to CozyChair's seat so the
 * seated-agent fake (model sunk 0.18) reads exactly the same. */
export const GAMING_CHAIR_SEAT_Y = 0.52;
/** Overall height (top of the headrest pillow). */
export const GAMING_CHAIR_HEIGHT = 1.42;

/**
 * Racing-style gaming chair: tall bucket back with side bolsters,
 * headrest + lumbar pillows, padded armrests, 5-star caster base with
 * gas-lift stem. Low-poly procedural, in the same visual language as
 * CozyChair, so it drops into the workstation chair slots unchanged
 * (same footprint, same facing convention, same seat height).
 *
 * This is the lightweight chair: a handful of boxes and cylinders,
 * no GLB download at all. It replaced the free3d.com GLB chair
 * (2026-10-25) after the user reported that chair felt very heavy
 * (24.47 MiB download, ~490k tris shared across 22 instances).
 */
export const GamingChair = memo(function GamingChair({
  position = [0, 0, 0],
  rotationY = 0,
  color = BODY,
  pinkStripe = false,
}: GamingChairProps) {
  const accent = pinkStripe ? COZY_CHAIR_PINK : color;
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

      {/* bucket seat */}
      <RoundedBox args={[0.58, 0.14, 0.55]} radius={0.06} smoothness={4} position={[0, GAMING_CHAIR_SEAT_Y, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.9} />
      </RoundedBox>
      {/* seat side bolsters */}
      {[-1, 1].map((s) => (
        <RoundedBox
          key={s}
          args={[0.12, 0.18, 0.5]}
          radius={0.05}
          smoothness={4}
          position={[s * 0.3, 0.6, 0]}
          rotation={[0, 0, -s * 0.2]}
          castShadow
        >
          <meshStandardMaterial color={color} roughness={0.9} />
        </RoundedBox>
      ))}

      {/* tall bucket backrest, slightly reclined, back at local -Z */}
      <RoundedBox
        args={[0.58, 0.78, 0.14]}
        radius={0.06}
        smoothness={4}
        position={[0, 1.0, -0.3]}
        rotation={[-0.1, 0, 0]}
        castShadow
      >
        <meshStandardMaterial color={color} roughness={0.9} />
      </RoundedBox>
      {/* back side bolsters */}
      {[-1, 1].map((s) => (
        <RoundedBox
          key={s}
          args={[0.13, 0.7, 0.12]}
          radius={0.05}
          smoothness={4}
          position={[s * 0.29, 1.0, -0.26]}
          rotation={[-0.1, 0, -s * 0.15]}
          castShadow
        >
          <meshStandardMaterial color={color} roughness={0.9} />
        </RoundedBox>
      ))}

      {/* headrest pillow (top) + lumbar pillow (lower back) */}
      <RoundedBox
        args={[0.3, 0.14, 0.1]}
        radius={0.04}
        smoothness={4}
        position={[0, 1.33, -0.22]}
        rotation={[-0.1, 0, 0]}
        castShadow
      >
        <meshStandardMaterial color={accent} roughness={0.9} />
      </RoundedBox>
      <RoundedBox
        args={[0.34, 0.16, 0.08]}
        radius={0.04}
        smoothness={4}
        position={[0, 0.78, -0.21]}
        rotation={[-0.1, 0, 0]}
        castShadow
      >
        <meshStandardMaterial color={accent} roughness={0.9} />
      </RoundedBox>

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
