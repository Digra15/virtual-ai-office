import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text, useGLTF, useAnimations } from "@react-three/drei";
import type { Group } from "three";
import { CUTES_MODEL_SCALE, LYING } from "./lying";
import { buildTypingPoseClip, TYPING_LEAN_X } from "./typingPose";

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

/** Game-style status icon above the head. */
const STATUS_ICON: Record<string, string> = {
  thinking: "?",
  working: "...",
  waiting: "...",
  meeting: "!",
  error: "!",
  recovering: "zZ",
  offline: "x",
  idle: "",
};

/** Status icon color. */
const STATUS_COLOR: Record<string, string> = {
  thinking: "#facc15",
  working: "#4ade80",
  waiting: "#facc15",
  meeting: "#38bdf8",
  error: "#f87171",
  recovering: "#c084fc",
  offline: "#9ca3af",
  idle: "#ffffff",
};

interface CutesAvatarProps {
  agentId: string;
  /** Display name shown above the head. */
  name: string;
  /** Agent status driving the overhead icon. */
  status: string;
  /** Body activity (drives the coffee-cup icon on pantry break). */
  activity?: string;
  /** Faked prayer posture (null = none). See usePresenceStore. */
  prayerPose?: "bowing" | "prostrate" | "sitting" | null;
  /** "desk" = seated at workstation, "free" = standing/walking */
  pose: "desk" | "free";
  walking: boolean;
  /** Lying flat on a recovery bed (derived in AgentAvatar: recovering +
   * holding a bed + not walking). Takes precedence over prayer poses. */
  lying?: boolean;
  /** status ring color */
  color: string;
  onClick?: () => void;
}

export function CutesAvatar({
  agentId,
  name,
  status,
  activity,
  prayerPose,
  pose,
  walking,
  lying = false,
  color,
  onClick,
}: CutesAvatarProps) {
  const group = useRef<Group>(null);
  const iconRef = useRef<Group>(null);
  const url = CUTES_MODEL[agentId] ?? CUTES_MODEL.nika;
  const { scene, animations } = useGLTF(url);
  const { actions, mixer } = useAnimations(animations, group);

  // Static typing pose: only a working agent seated at its desk, never
  // while walking, lying, or praying (those take precedence below).
  const isTyping = pose === "desk" && status === "working" && !lying && !walking;
  const typingClip = useMemo(
    () =>
      buildTypingPoseClip(
        animations.find((a) => a.name === "Armature|Idle"),
      ),
    [animations],
  );

  // Play Idle by default, Walk when moving, Idle when lying flat, and
  // the derived typing pose when working at a desk.
  // Grounded was the first lying clip but looped as walking/flailing:
  // it is only 0.33s with large foot/hand rotation swings (see
  // lying.ts), so lying now uses Idle — the calmest clip in the bundle.
  useEffect(() => {
    const idle = actions["Armature|Idle"];
    const walk = actions["Armature|Walk"];
    const grounded = actions["Armature|Grounded"];
    const typing =
      isTyping && typingClip && group.current
        ? mixer.clipAction(typingClip, group.current)
        : null;
    if (typing) {
      idle?.stop();
      walk?.stop();
      grounded?.stop();
      typing.reset().play();
    } else if (lying) {
      walk?.stop();
      grounded?.stop();
      idle?.reset().play();
    } else if (walking) {
      idle?.stop();
      grounded?.stop();
      walk?.reset().play();
    } else {
      walk?.stop();
      grounded?.stop();
      (idle ?? grounded)?.reset().play();
    }
    return () => {
      idle?.stop();
      walk?.stop();
      grounded?.stop();
      typing?.stop();
    };
  }, [actions, mixer, walking, lying, isTyping, typingClip]);

  // Lively status animation: big bounce + wiggle + pulse.
  // (iconRef is a child of the Billboard at y=2.25, so animate around 0.)
  useFrame(({ clock }) => {
    if (!iconRef.current) return;
    const t = clock.getElapsedTime();
    iconRef.current.position.y = Math.abs(Math.sin(t * 4)) * 0.15;
    const s = 1 + Math.sin(t * 6) * 0.15;
    iconRef.current.scale.setScalar(s);
    iconRef.current.rotation.z = Math.sin(t * 4) * 0.15;
  });

  // Seated: sink the model so the chair seat is at hip level and the
  // desk occludes the short chibi legs. Standing: full height on floor.
  const isSeated = pose === "desk";
  const scale = CUTES_MODEL_SCALE;
  const y = isSeated ? 0.18 : 0;
  const icon = STATUS_ICON[status] ?? "";
  const iconColor = STATUS_COLOR[status] ?? "#ffffff";
  // Pantry break: a bobbing 3D coffee cup instead of a text icon.
  const onBreak = activity === "break";

  // Faked prayer transforms (whole-model, since the rig has no
  // knee/waist joints). Positive X rotation pitches the head toward
  // the nose (local +z). Applied to the model group only, so the HUD
  // above the head stays upright.
  const prayerRotation: [number, number, number] =
    prayerPose === "bowing"
      ? [1.05, 0, 0]
      : prayerPose === "prostrate"
        ? [1.45, 0, 0]
        : [0, 0, 0];
  const prayerY = prayerPose === "prostrate" ? 0.18 : y;
  const prayerScale: [number, number, number] =
    prayerPose === "sitting" ? [0.95, 0.62, 0.95] : [scale, scale, scale];

  // Lying flat on a recovery bed (whole-model fake, like prayer).
  // Takes precedence over prayer (the two never coincide in practice:
  // prayer only triggers in the musola, lying only on a recovery bed).
  // rotation.x = -PI/2 pitches the body axis to local -z (north, with
  // the outer yaw set to LYING.facing = 0) and the face to straight up;
  // groupY/groupZ centre the pitched body on the bed (see lying.ts).
  // The HUD Billboards below are NOT in this group, so they stay
  // upright — only their heights drop to hover over the flat body.
  const modelPosition: [number, number, number] = lying
    ? [0, LYING.groupY, LYING.groupZ]
    : [0, prayerY, 0];
  const modelScale: [number, number, number] = lying
    ? [scale, scale, scale]
    : prayerScale;
  // Typing lean: a slight forward pitch toward the desk, applied to
  // the model group only (HUD stays upright). Prayer takes precedence
  // over typing; lying takes precedence over both.
  const modelRotation: [number, number, number] = lying
    ? [LYING.rotationX, 0, 0]
    : prayerPose
      ? prayerRotation
      : isTyping
        ? [TYPING_LEAN_X, 0, 0]
        : [0, 0, 0];
  const hudNameY = lying ? LYING.hudNameY : 2.6;
  const hudIconY = lying ? LYING.hudIconY : 2.25;

  return (
    <group
      ref={group}
      // NO inner facing rotation: the movement registry's outer group
      // already stores the nose direction (travel direction while
      // walking, desk/qibla/table facing on arrival), and CUTES models
      // face +z by default. An inner rotation here double-applies
      // facing — it made slot-less agents (spawned agents, whose
      // AGENT_FACING falls back to 0) walk backwards.
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
      <group
        position={modelPosition}
        scale={modelScale}
        rotation={modelRotation}
      >
        <primitive object={scene} />
      </group>
      {/* Game-style overhead HUD: NAME on top, status icon below it. */}
      <Billboard position={[0, hudNameY, 0]}>
        <Text
          fontSize={0.22}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#000000"
        >
          {name}
        </Text>
      </Billboard>
      {icon !== "" && !onBreak && (
        <Billboard position={[0, hudIconY, 0]}>
          <group ref={iconRef}>
            <Text
              fontSize={0.3}
              color={iconColor}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.05}
              outlineColor="#000000"
            >
              {icon}
            </Text>
          </group>
        </Billboard>
      )}
      {/* Pantry break: bobbing 3D coffee cup above the head. */}
      {onBreak && (
        <Billboard position={[0, hudIconY, 0]}>
          <group ref={iconRef}>
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.11, 0.09, 0.16, 16]} />
              <meshStandardMaterial color="#ffffff" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.095, 0.095, 0.02, 16]} />
              <meshStandardMaterial color="#6b4a2f" roughness={0.6} />
            </mesh>
            <mesh position={[0.13, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.06, 0.018, 8, 16]} />
              <meshStandardMaterial color="#ffffff" roughness={0.4} />
            </mesh>
          </group>
        </Billboard>
      )}
    </group>
  );
}

// Preload all models so switching is instant.
Object.values(CUTES_MODEL).forEach((url) => useGLTF.preload(url));
