import { useEffect, useRef } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import type { Group } from "three";

/**
 * CUTES 3D character (poly.pizza bundle by J-Toastie, CC-BY).
 * Replaces the 2D AI sprite billboards with real low-poly 3D models.
 * Credit: "CUTES Part One by J-Toastie [CC-BY] via Poly Pizza".
 */

export const CUTES_MODEL: Record<string, string> = {
  nika: "/models/cutes/Generic Female.glb",
  research: "/models/cutes/Crypto Bro.glb",
  coding: "/models/cutes/Generic Male.glb",
  writing: "/models/cutes/Citizen 3.glb",
  design: "/models/cutes/Citizen 2.glb",
  data: "/models/cutes/Citizen 1.glb",
  automation: "/models/cutes/Retail Worker.glb",
  monitoring: "/models/cutes/Prisoner.glb",
};

interface CutesAvatarProps {
  agentId: string;
  /** "desk" = seated at workstation, "free" = standing/walking */
  pose: "desk" | "free";
  /** group facing in radians (PI = north toward monitors) */
  facing: number;
  walking: boolean;
  /** status ring color */
  color: string;
  onClick?: () => void;
}

export function CutesAvatar({
  agentId,
  pose,
  facing,
  walking,
  color,
  onClick,
}: CutesAvatarProps) {
  const group = useRef<Group>(null);
  const url = CUTES_MODEL[agentId] ?? CUTES_MODEL.nika;
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, group);

  // Play Idle by default, Walk when moving.
  useEffect(() => {
    const idle = actions["Armature|Idle"];
    const walk = actions["Armature|Walk"];
    const grounded = actions["Armature|Grounded"];
    if (walking) {
      idle?.stop();
      grounded?.stop();
      walk?.reset().play();
    } else {
      walk?.stop();
      (idle ?? grounded)?.reset().play();
    }
    return () => {
      idle?.stop();
      walk?.stop();
      grounded?.stop();
    };
  }, [actions, walking]);

  // Seated: sink the model so the chair seat is at hip level and the
  // desk occludes the short chibi legs. Standing: full height on floor.
  const isSeated = pose === "desk";
  const scale = 0.95;
  const y = isSeated ? 0.18 : 0;

  return (
    <group
      ref={group}
      // CUTES models face -z by default (opposite of the 2D sprites),
      // so add PI to flip them to the intended facing.
      rotation={[0, facing + Math.PI, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {/* status ring on the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.55, 0.65, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      <group position={[0, y, 0]} scale={scale}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

// Preload all models so switching is instant.
Object.values(CUTES_MODEL).forEach((url) => useGLTF.preload(url));
