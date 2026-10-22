import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { AgentInfo } from "@virtual-ai-office/shared";
import { STATUS_META } from "../../utils/status";
import {
  geoBox,
  geoCapsule,
  geoOctahedron,
  geoSphere,
  geoTorus,
} from "../geometries";
import { matEye, matSkin } from "../materials";
import {
  agentCursorHandlers,
  makeAgentClickHandler,
} from "../interaction/selectAgent";

interface AgentAvatarProps {
  agent: AgentInfo;
  position: [number, number, number];
  /** World Y rotation (desk rotation + PI so the avatar faces its monitor). */
  rotationY: number;
  /** Status color driving body tint, ring and label. */
  color: string;
}

/**
 * HONEST PLACEHOLDER: this character is a procedural low-poly figure assembled
 * from primitives (capsule body, sphere head, arm capsules) — NOT a rigged 3D
 * model. It exists so agent presence, position and status are visible in the
 * 3D office without shipping external model assets.
 *
 * The figure sits at local (0, 0, 0.95) facing desk-local -z (toward the
 * monitor). All animation runs in useFrame via refs — no React state updates.
 */
export const AgentAvatar = memo(function AgentAvatar({
  agent,
  position,
  rotationY,
  color,
}: AgentAvatarProps) {
  const torso = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const indicator = useRef<THREE.Mesh>(null);

  const status = agent.status;

  // Clicking any visible part of the character selects the agent (same path
  // as dashboard selection: select + detail panel + camera focus).
  const handleClick = useMemo(
    () => makeAgentClickHandler(agent.id, agent.workstationId),
    [agent.id, agent.workstationId],
  );
  const cursorHandlers = useMemo(() => agentCursorHandlers(), []);

  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.6,
      }),
    [color],
  );
  const ringMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.7,
        roughness: 0.4,
      }),
    [color],
  );
  const indicatorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0b0f1a",
        emissive: new THREE.Color(color),
        emissiveIntensity: 1.4,
        roughness: 0.4,
      }),
    [color],
  );

  // Base indicator scale per status (must match renderIndicator below).
  const indicatorBaseScale =
    status === "error"
      ? 0.18
      : status === "waiting"
        ? 0.35
        : status === "thinking"
          ? 0.16
          : 0.09;

  // Reset any animation transforms when the status changes so a previous
  // status's pose doesn't leak into the new one. (The indicator <mesh> is
  // reconciled rather than remounted across statuses, so every property the
  // animation loop mutates must be restored here.)
  useEffect(() => {
    if (torso.current) {
      torso.current.position.y = 0;
      torso.current.rotation.z = 0;
    }
    if (body.current) body.current.scale.set(0.45, 0.55, 0.45);
    if (head.current) {
      head.current.rotation.set(0, 0, 0);
      head.current.position.set(0, 1.45, 0.03);
    }
    if (armL.current) armL.current.rotation.x = -0.85;
    if (armR.current) armR.current.rotation.x = -0.85;
    if (ring.current) ring.current.scale.set(1.3, 1.3, 1);
    if (indicator.current) {
      indicator.current.visible = true;
      indicator.current.rotation.set(0, 0, 0);
      indicator.current.position.set(0, 2.0, 0);
      indicator.current.scale.setScalar(indicatorBaseScale);
    }
  }, [status, indicatorBaseScale]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    switch (status) {
      case "working":
        // typing: torso bob + alternating arm pumps + slight head nod.
        // Amplitudes are deliberately generous — sub-pixel motion is
        // indistinguishable from a frozen frame in screenshots.
        if (torso.current) torso.current.position.y = Math.sin(t * 6) * 0.07;
        if (armL.current)
          armL.current.rotation.x = -0.85 + Math.sin(t * 6) * 0.28;
        if (armR.current)
          armR.current.rotation.x =
            -0.85 + Math.sin(t * 6 + Math.PI) * 0.28;
        if (head.current) head.current.rotation.x = Math.sin(t * 6) * 0.06;
        break;
      case "thinking":
        // head tilt sway + hover bob + breathing status ring
        if (head.current) {
          head.current.rotation.z = Math.sin(t * 1.4) * 0.3;
          head.current.position.y = 1.45 + Math.sin(t * 2.1) * 0.05;
        }
        if (ring.current) {
          const k = 1 + Math.sin(t * 2.4) * 0.12;
          ring.current.scale.set(1.3 * k, 1.3 * k, 1);
        }
        break;
      case "idle":
        // calm breathing + gentle sway
        if (body.current)
          body.current.scale.set(
            0.45,
            0.55 * (1 + Math.sin(t * 1.6) * 0.05),
            0.45,
          );
        if (torso.current) torso.current.rotation.z = Math.sin(t * 0.9) * 0.04;
        break;
      case "waiting":
        // tumbling, bobbing indicator — unmistakable at a glance
        if (indicator.current) {
          indicator.current.rotation.x += delta * 3.2;
          indicator.current.position.y = 2.0 + Math.sin(t * 3.2) * 0.16;
        }
        break;
      case "error":
        // urgent blink + pulse
        if (indicator.current) {
          const pulse = Math.sin(t * 9);
          indicator.current.visible = pulse > -0.2;
          indicator.current.scale.setScalar(
            indicatorBaseScale * (1 + Math.max(0, pulse) * 0.35),
          );
        }
        break;
      case "offline":
        break; // static, gray
    }
  });

  const renderIndicator = () => {
    const y = 2.0;
    switch (status) {
      case "error":
        return (
          <mesh
            ref={indicator}
            geometry={geoOctahedron}
            material={indicatorMat}
            scale={0.18}
            position={[0, y, 0]}
          />
        );
      case "waiting":
        return (
          <mesh
            ref={indicator}
            geometry={geoTorus}
            material={indicatorMat}
            scale={0.35}
            position={[0, y, 0]}
          />
        );
      case "thinking":
        return (
          <mesh
            ref={indicator}
            geometry={geoSphere}
            material={indicatorMat}
            scale={0.16}
            position={[0, y, 0]}
          />
        );
      case "working":
        return (
          <mesh
            geometry={geoSphere}
            material={indicatorMat}
            scale={0.09}
            position={[0, y, 0]}
          />
        );
      default:
        return null; // idle / offline: no indicator
    }
  };

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      onClick={handleClick}
      {...cursorHandlers}
    >
      {/* seated figure, faces desk-local -z (the monitor) */}
      <group position={[0, 0, 0.95]} rotation={[0, Math.PI, 0]}>
        {/* status ring at base */}
        <mesh
          ref={ring}
          geometry={geoTorus}
          material={ringMat}
          scale={1.3}
          position={[0, 0.06, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <group ref={torso}>
          {/* body */}
          <mesh
            ref={body}
            geometry={geoCapsule}
            material={bodyMat}
            scale={[0.45, 0.55, 0.45]}
            position={[0, 0.98, 0]}
            rotation={[0.12, 0, 0]}
            castShadow
          />
          {/* head */}
          <group ref={head} position={[0, 1.45, 0.03]}>
            <mesh geometry={geoSphere} material={matSkin} scale={0.34} castShadow />
            <mesh geometry={geoSphere} material={matEye} scale={0.055} position={[-0.065, 0.02, 0.145]} />
            <mesh geometry={geoSphere} material={matEye} scale={0.055} position={[0.065, 0.02, 0.145]} />
          </group>
          {/* arms reaching toward the desk */}
          <mesh
            ref={armL}
            geometry={geoCapsule}
            material={bodyMat}
            scale={[0.16, 0.4, 0.16]}
            position={[-0.26, 1.05, 0.14]}
            rotation={[-0.85, 0, 0.15]}
            castShadow
          />
          <mesh
            ref={armR}
            geometry={geoCapsule}
            material={bodyMat}
            scale={[0.16, 0.4, 0.16]}
            position={[0.26, 1.05, 0.14]}
            rotation={[-0.85, 0, -0.15]}
            castShadow
          />
          {/* thighs */}
          <mesh geometry={geoBox} material={bodyMat} scale={[0.16, 0.14, 0.42]} position={[-0.13, 0.62, 0.28]} />
          <mesh geometry={geoBox} material={bodyMat} scale={[0.16, 0.14, 0.42]} position={[0.13, 0.62, 0.28]} />
        </group>
        {renderIndicator()}
        {/* name + status label, always faces the camera */}
        <Billboard position={[0, 2.55, 0]}>
          <Text
            fontSize={0.38}
            color="#f8fafc"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#0b0f1a"
          >
            {agent.name}
          </Text>
          <Text
            fontSize={0.22}
            color={color}
            anchorX="center"
            anchorY="middle"
            position={[0, -0.34, 0]}
          >
            {STATUS_META[status].label}
          </Text>
        </Billboard>
      </group>
    </group>
  );
});
