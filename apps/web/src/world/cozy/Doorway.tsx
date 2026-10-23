import { memo, useEffect, useMemo } from "react";
import { drawDoorLabel, makeTexture } from "./textures";

export type DoorwayVariant =
  | "wood"
  | "glass"
  | "hospital"
  | "security"
  | "restroom_m"
  | "restroom_f"
  | "open_arch"
  | "double_glass";

export interface DoorwayProps {
  /** World position of the doorway center at floor level. */
  position: [number, number, number];
  /**
   * Yaw. rotationY=0 → the doorway spans local X (opening faces ±Z).
   * Positive `openAngle` swings the leaf toward local +Z, so mount the
   * doorway with +Z pointing into the room interior.
   */
  rotationY?: number;
  width?: number;
  height?: number;
  variant?: DoorwayVariant;
  /** Optional text plate mounted above the header. */
  label?: string;
  /** Leaf swing in radians. Default ~0.95 (swung open into the room). */
  openAngle?: number;
}

/** The user's builder dimensions, kept: posts 0.08 thick, threshold plate. */
export const DOORWAY_POST = 0.08;
export const DOORWAY_OPEN_ANGLE_DEFAULT = 0.95;
export const DOORWAY_WIDTH_DEFAULT = 1.15;
export const DOORWAY_HEIGHT_DEFAULT = 2.15;

export interface DoorwayStyle {
  frame: string;
  leaf: string;
  leafOpacity: number;
  leafTransparent: boolean;
  hasLeaf: boolean;
  doubleLeaf: boolean;
  badge: "cross" | "toilet_m" | "toilet_f" | "keypad" | null;
  window: boolean;
  arch: boolean;
  handle: string;
}

/**
 * Pure variant → style mapping (no three.js needed), so tests and room
 * code can resolve a variant without rendering.
 */
export function doorwayVariantStyle(variant: DoorwayVariant): DoorwayStyle {
  switch (variant) {
    case "wood":
      return {
        frame: "#8b5a2b", leaf: "#a06a35", leafOpacity: 1, leafTransparent: false,
        hasLeaf: true, doubleLeaf: false, badge: null, window: false, arch: false,
        handle: "#d9d9d9",
      };
    case "glass":
      return {
        frame: "#3a4354", leaf: "#bcd6e8", leafOpacity: 0.3, leafTransparent: true,
        hasLeaf: true, doubleLeaf: false, badge: null, window: false, arch: false,
        handle: "#cbd5e1",
      };
    case "hospital":
      return {
        frame: "#f9a8d4", leaf: "#fdf2f8", leafOpacity: 1, leafTransparent: false,
        hasLeaf: true, doubleLeaf: false, badge: "cross", window: true, arch: false,
        handle: "#9d174d",
      };
    case "security":
      return {
        frame: "#1f2937", leaf: "#374151", leafOpacity: 1, leafTransparent: false,
        hasLeaf: true, doubleLeaf: false, badge: "keypad", window: false, arch: false,
        handle: "#9ca3af",
      };
    case "restroom_m":
      return {
        frame: "#e5e7eb", leaf: "#f8fafc", leafOpacity: 1, leafTransparent: false,
        hasLeaf: true, doubleLeaf: false, badge: "toilet_m", window: false, arch: false,
        handle: "#3b82f6",
      };
    case "restroom_f":
      return {
        frame: "#e5e7eb", leaf: "#f8fafc", leafOpacity: 1, leafTransparent: false,
        hasLeaf: true, doubleLeaf: false, badge: "toilet_f", window: false, arch: false,
        handle: "#ec4899",
      };
    case "open_arch":
      return {
        frame: "#8b5a2b", leaf: "#000000", leafOpacity: 0, leafTransparent: true,
        hasLeaf: false, doubleLeaf: false, badge: null, window: false, arch: true,
        handle: "#d9d9d9",
      };
    case "double_glass":
      return {
        frame: "#3a4354", leaf: "#bcd6e8", leafOpacity: 0.3, leafTransparent: true,
        hasLeaf: true, doubleLeaf: true, badge: null, window: false, arch: false,
        handle: "#cbd5e1",
      };
  }
}

function Leaf({
  x,
  width,
  height,
  style,
  openAngle,
  mirrored = false,
}: {
  x: number;
  width: number;
  height: number;
  style: DoorwayStyle;
  openAngle: number;
  mirrored?: boolean;
}) {
  const leafW = width - DOORWAY_POST * 2;
  const leafH = height - 0.06;
  return (
    <group position={[x, 0, 0]} rotation={[0, mirrored ? openAngle : -openAngle, 0]}>
      <mesh position={[(mirrored ? -1 : 1) * (leafW / 2), leafH / 2 + 0.02, 0]} castShadow>
        <boxGeometry args={[leafW, leafH, 0.05]} />
        <meshStandardMaterial
          color={style.leaf}
          transparent={style.leafTransparent}
          opacity={style.leafOpacity}
          roughness={style.leafTransparent ? 0.1 : 0.6}
        />
      </mesh>
      {/* hospital porthole window */}
      {style.window && (
        <mesh position={[(mirrored ? -1 : 1) * (leafW / 2), height - 0.55, 0.001]}>
          <planeGeometry args={[0.3, 0.4]} />
          <meshStandardMaterial color="#bcd6e8" transparent opacity={0.45} roughness={0.1} />
        </mesh>
      )}
      {/* cross badge (hospital) */}
      {style.badge === "cross" && (
        <group position={[(mirrored ? -1 : 1) * (leafW / 2), height - 1.15, 0.036]}>
          <mesh>
            <boxGeometry args={[0.22, 0.22, 0.02]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <boxGeometry args={[0.13, 0.045, 0.012]} />
            <meshStandardMaterial color="#f472b6" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <boxGeometry args={[0.045, 0.13, 0.012]} />
            <meshStandardMaterial color="#f472b6" roughness={0.5} />
          </mesh>
        </group>
      )}
      {/* restroom badge: blue / pink disc */}
      {(style.badge === "toilet_m" || style.badge === "toilet_f") && (
        <group position={[(mirrored ? -1 : 1) * (leafW / 2), height - 0.55, 0.036]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.02, 24]} />
            <meshStandardMaterial
              color={style.badge === "toilet_m" ? "#3b82f6" : "#ec4899"}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.075, 0.075, 0.022, 24]} />
            <meshStandardMaterial color="#ffffff" roughness={0.4} />
          </mesh>
        </group>
      )}
      {/* handle: knob for single leaves, steel bar for double glass */}
      {style.doubleLeaf ? (
        <mesh
          position={[(mirrored ? -1 : 1) * (leafW - 0.12), 1.05, 0.07]}
        >
          <cylinderGeometry args={[0.018, 0.018, 0.55, 10]} />
          <meshStandardMaterial color={style.handle} roughness={0.25} metalness={0.9} />
        </mesh>
      ) : (
        <mesh
          position={[(mirrored ? -1 : 1) * (leafW - 0.16), 1.05, 0.055]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.02, 0.02, 0.12, 10]} />
          <meshStandardMaterial color={style.handle} roughness={0.3} metalness={0.8} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Doorway: frame posts + header + lintel + threshold plate, with a
 * leaf hinged on the left post swung open `openAngle` into the room.
 * rotationY=0 → the doorway spans local X.
 */
export const Doorway = memo(function Doorway({
  position,
  rotationY = 0,
  width = DOORWAY_WIDTH_DEFAULT,
  height = DOORWAY_HEIGHT_DEFAULT,
  variant = "wood",
  label,
  openAngle = DOORWAY_OPEN_ANGLE_DEFAULT,
}: DoorwayProps) {
  const style = doorwayVariantStyle(variant);
  const postX = width / 2 - DOORWAY_POST / 2;

  const labelTex = useMemo(() => {
    if (!label) return null;
    return makeTexture((ctx, w, h) => drawDoorLabel(ctx, w, h, label), 512, 128);
  }, [label]);
  useEffect(() => () => labelTex?.dispose(), [labelTex]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* posts */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * postX, height / 2, 0]} castShadow>
          <boxGeometry args={[DOORWAY_POST, height, 0.14]} />
          <meshStandardMaterial color={style.frame} roughness={0.6} />
        </mesh>
      ))}
      {/* header + lintel */}
      <mesh position={[0, height + 0.07, 0]} castShadow>
        <boxGeometry args={[width + 0.08, 0.14, 0.16]} />
        <meshStandardMaterial color={style.frame} roughness={0.6} />
      </mesh>
      <mesh position={[0, height + 0.165, 0]} castShadow>
        <boxGeometry args={[width + 0.2, 0.05, 0.18]} />
        <meshStandardMaterial color={style.frame} roughness={0.6} />
      </mesh>
      {/* threshold plate */}
      <mesh position={[0, 0.015, 0]}>
        <boxGeometry args={[width + 0.1, 0.03, 0.22]} />
        <meshStandardMaterial color="#9aa3b2" roughness={0.35} metalness={0.7} />
      </mesh>

      {/* open-arch trim instead of a leaf */}
      {style.arch && (
        <mesh position={[0, height - 0.02, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[width / 2 - 0.02, 0.045, 10, 24, Math.PI]} />
          <meshStandardMaterial color={style.frame} roughness={0.6} />
        </mesh>
      )}

      {/* leaves */}
      {style.hasLeaf && !style.doubleLeaf && (
        <Leaf x={-postX} width={width} height={height} style={style} openAngle={openAngle} />
      )}
      {style.hasLeaf && style.doubleLeaf && (
        <>
          <Leaf
            x={-postX}
            width={width / 2 + DOORWAY_POST / 2}
            height={height}
            style={style}
            openAngle={openAngle * 0.7}
          />
          <Leaf
            x={postX}
            width={width / 2 + DOORWAY_POST / 2}
            height={height}
            style={style}
            openAngle={openAngle * 0.7}
            mirrored
          />
        </>
      )}

      {/* security keypad + LED on the right post */}
      {style.badge === "keypad" && (
        <group position={[postX, 1.25, 0.085]}>
          <mesh>
            <boxGeometry args={[0.1, 0.16, 0.03]} />
            <meshStandardMaterial color="#11151c" roughness={0.5} />
          </mesh>
          {[-0.028, 0, 0.028].map((bx) =>
            [-0.045, 0, 0.045].map((by) => (
              <mesh key={`${bx}${by}`} position={[bx, by - 0.01, 0.017]}>
                <boxGeometry args={[0.02, 0.02, 0.008]} />
                <meshStandardMaterial color="#4b5563" roughness={0.5} />
              </mesh>
            )),
          )}
          <mesh position={[0, 0.062, 0.017]}>
            <boxGeometry args={[0.05, 0.018, 0.008]} />
            <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.4} />
          </mesh>
        </group>
      )}

      {/* optional label plate above the header */}
      {label && labelTex && (
        <mesh position={[0, height + 0.42, 0.02]}>
          <planeGeometry args={[0.95, 0.24]} />
          <meshStandardMaterial map={labelTex} roughness={0.6} />
        </mesh>
      )}
    </group>
  );
});
