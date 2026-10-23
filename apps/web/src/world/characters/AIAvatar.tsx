import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import type { AgentInfo } from "@virtual-ai-office/shared";
import { movement } from "../movement";
import { isInMusola, QIBLA_FACING } from "./facing";
import { STATUS_META } from "../../utils/status";
import { geoOctahedron, geoSphere, geoTorus } from "../geometries";
import {
  agentCursorHandlers,
  makeAgentClickHandler,
} from "../interaction/selectAgent";
import type { ChibiAnimation } from "./characterTypes";
import { wrapAngle } from "./characterTypes";

interface AIAvatarProps {
  agent: AgentInfo;
  color: string;
  interactive?: boolean;
  showLabel?: boolean;
  groupRef: { current: THREE.Group | null };
  pose?: "desk" | "free";
  animationOverride?: ChibiAnimation | null;
}

/**
 * AIAvatar — AI-generated anime character as an animated 3D billboard.
 *
 * Each agent has a beautiful AI-generated full-body sprite
 * (`/avatars/{agentId}.png`, transparent background). The plane Y-billboards
 * to face the camera; animation is procedural transform (bob, lean, squash)
 * driven by the agent's live status/activity — no frame sheets needed.
 *
 * Status chrome (ring, indicator, name label), click-to-select, prayer
 * detection, and movement-registry integration mirror PixelAvatar.
 */

const FIGURE_H = 1.85;
const aspectCache: Record<string, number> = {};

export const AIAvatar = memo(function AIAvatar({
  agent,
  color,
  interactive = true,
  showLabel = true,
  groupRef,
  pose = "desk",
  animationOverride = null,
}: AIAvatarProps) {
  const status = agent.status;

  const figure = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const indicator = useRef<THREE.Mesh>(null);
  const texRef = useRef<THREE.Texture | null>(null);
  const typingTexRef = useRef<THREE.Texture | null>(null);
  const sittingTexRef = useRef<THREE.Texture | null>(null);
  const sleepingTexRef = useRef<THREE.Texture | null>(null);

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

  const indicatorBaseScale =
    status === "error" ? 0.18
    : status === "waiting" ? 0.35
    : status === "thinking" ? 0.16
    : 0.09;

  useEffect(() => {
    if (ring.current) ring.current.scale.set(1.3, 1.3, 1);
    if (indicator.current) {
      indicator.current.visible = true;
      indicator.current.rotation.set(0, 0, 0);
      indicator.current.position.set(0, 2.02, 0);
      indicator.current.scale.setScalar(indicatorBaseScale);
    }
  }, [status, indicatorBaseScale]);

  const handleClick = useMemo(
    () => makeAgentClickHandler(agent.id, agent.workstationId),
    [agent.id, agent.workstationId],
  );
  const cursorHandlers = useMemo(() => agentCursorHandlers(), []);
  const tmpV = useMemo(() => new THREE.Vector3(), []);

  // Load the AI sprite textures (standing + typing + sitting + sleeping).
  useEffect(() => {
    texRef.current = null;
    typingTexRef.current = null;
    sittingTexRef.current = null;
    sleepingTexRef.current = null;
    let alive = true;
    const loader = new THREE.TextureLoader();
    const loadTex = (url: string, cb: (t: THREE.Texture) => void) => {
      loader.load(url, (t) => {
        if (!alive) { t.dispose(); return; }
        t.colorSpace = THREE.SRGBColorSpace;
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.anisotropy = 4;
        const img = t.image as HTMLImageElement | undefined;
        if (img?.width && img?.height) aspectCache[url] = img.width / img.height;
        cb(t);
      }, undefined, () => {});
    };
    loadTex(`/avatars/${agent.id}.png`, (t) => { texRef.current = t; });
    loadTex(`/avatars/${agent.id}-typing.png`, (t) => { typingTexRef.current = t; });
    loadTex(`/avatars/${agent.id}-sitting.png`, (t) => { sittingTexRef.current = t; });
    loadTex(`/avatars/${agent.id}-sleeping.png`, (t) => { sleepingTexRef.current = t; });
    return () => {
      alive = false;
      texRef.current?.dispose(); texRef.current = null;
      typingTexRef.current?.dispose(); typingTexRef.current = null;
      sittingTexRef.current?.dispose(); sittingTexRef.current = null;
      sleepingTexRef.current?.dispose(); sleepingTexRef.current = null;
    };
  }, [agent.id]);

  // celebrate edge-trigger
  const celebrateUntil = useRef(0);
  const prevProgress = useRef<number | null>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const g = groupRef.current;
    if (!g) return;

    // progress → celebrate hop
    const p = typeof agent.progress === "number" ? agent.progress : null;
    if (p !== null && p >= 100 && (prevProgress.current === null || prevProgress.current < 100)) {
      celebrateUntil.current = t + 2.5;
    }
    prevProgress.current = p;
    const celebrating = t < celebrateUntil.current;

    const walking = movement.isMoving(agent.id);
    const inMusola = isInMusola(agent.id);
    const praying = inMusola && !walking;

    // pick texture by pose/activity:
    // - sleeping: status recovering (in recovery bed)
    // - typing: working/thinking at desk
    // - sitting: idle at the lobby sofa (near 6.5,6.5)
    // - else: standing
    const pos = movement.getPosition3D(agent.id);
    const nearSofa = pos && Math.hypot(pos.x - 6.5, pos.z - 6.5) < 1.2;
    const isSleeping = status === "recovering" && !walking && !praying;
    const useTyping = !isSleeping && (status === "working" || status === "thinking") && pose === "desk" && !walking && !praying;
    const useSitting = !isSleeping && !useTyping && pose === "free" && !walking && !praying && nearSofa && status === "idle";

    let wantTex = texRef.current;
    let wantKey = `/avatars/${agent.id}.png`;
    if (isSleeping && sleepingTexRef.current) {
      wantTex = sleepingTexRef.current;
      wantKey = `/avatars/${agent.id}-sleeping.png`;
    } else if (useTyping && typingTexRef.current) {
      wantTex = typingTexRef.current;
      wantKey = `/avatars/${agent.id}-typing.png`;
    } else if (useSitting && sittingTexRef.current) {
      wantTex = sittingTexRef.current;
      wantKey = `/avatars/${agent.id}-sitting.png`;
    }
    const wantAspect = aspectCache[wantKey] ?? 0.5;
    // apply texture once loaded / on switch
    if (mat.current && wantTex && mat.current.map !== wantTex) {
      const firstMap = mat.current.map == null;
      mat.current.map = wantTex;
      if (firstMap) mat.current.needsUpdate = true;
    }

    // Y-billboard angle (applied in the animation block below; skipped when flat)
    g.getWorldPosition(tmpV);
    const camAz = Math.atan2(state.camera.position.x - tmpV.x, state.camera.position.z - tmpV.z);
    const facing = praying ? QIBLA_FACING : g.rotation.y;

    // procedural animation
    const fig = figure.current;
    if (fig) {
      const baseY = 0.95;
      const aspect = wantAspect;
      let y = baseY, sx = 1, sy = 1, rz = 0, rx = 0;
      let px = 0, pz = 0; // figure local offset
      let flat = false; // lay the plane horizontal (sleeping)
      if (isSleeping) {
        // lying flat on the recovery bed: mattress top y≈0.68, head north
        flat = true;
        y = 0.78;
        // scale to fit bed length (2.1): image is wide (lying down)
        const len = 1.95;
        sx = len / FIGURE_H;
        sy = len / FIGURE_H / aspect;
      } else if (useTyping) {
        // sitting at the desk typing: seat height, nudged toward the desk
        // (north, -z), hands near the keyboard; subtle key-bounce
        y = 0.82 + Math.sin(t * 8) * 0.008;
        pz = -0.3;
        rx = 0.04;
      } else if (praying) {
        y = baseY - 0.02 + Math.sin(t * 1.2) * 0.008;
        rx = 0.06;
      } else if (walking) {
        const w = t * 9;
        y = baseY + Math.abs(Math.sin(w)) * 0.09;
        rz = Math.sin(w) * 0.06;
        rx = -0.08;
        sx = 1 + Math.sin(w * 2) * 0.02;
        sy = 1 - Math.sin(w * 2) * 0.02;
      } else if (celebrating) {
        const w = t * 6;
        y = baseY + Math.abs(Math.sin(w)) * 0.16;
        rz = Math.sin(w * 0.5) * 0.1;
      } else if (status === "thinking") {
        y = baseY + Math.sin(t * 1.8) * 0.02;
        rz = 0.08;
      } else if (status === "working" || animationOverride === "meeting") {
        y = baseY + Math.sin(t * 2.6) * 0.015;
        rx = pose === "desk" ? 0.05 : 0;
      } else {
        y = baseY + Math.sin(t * 1.6) * 0.025;
        sy = 1 + Math.sin(t * 1.6) * 0.008;
      }
      if (flat) {
        // sleeping: plane lies flat on the bed, head north, no billboard
        fig.position.set(px, y, pz);
        fig.scale.set(FIGURE_H * aspect * sx, FIGURE_H * sy, 1);
        fig.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
      } else {
        fig.position.set(px, y, pz);
        fig.scale.set(FIGURE_H * aspect * sx, FIGURE_H * sy, 1);
        fig.rotation.z = rz;
        fig.rotation.x = rx;
        // Y-billboard (skip when flat)
        fig.rotation.y = wrapAngle(camAz - facing + Math.PI);
      }
    }

    // status chrome
    if (status === "thinking" && ring.current) {
      const k = 1 + Math.sin(t * 2.4) * 0.12;
      ring.current.scale.set(1.3 * k, 1.3 * k, 1);
    }
    if (status === "waiting" && indicator.current) {
      indicator.current.rotation.x += delta * 3.2;
      indicator.current.position.y = 2.02 + Math.sin(t * 3.2) * 0.16;
    }
    if (status === "error" && indicator.current) {
      const pulse = Math.sin(t * 9);
      indicator.current.visible = pulse > -0.2;
      indicator.current.scale.setScalar(indicatorBaseScale * (1 + Math.max(0, pulse) * 0.35));
    }
  });

  const renderIndicator = () => {
    const y = 2.02;
    switch (status) {
      case "error":
        return <mesh ref={indicator} geometry={geoOctahedron} material={indicatorMat} scale={0.18} position={[0, y, 0]} />;
      case "waiting":
        return <mesh ref={indicator} geometry={geoTorus} material={indicatorMat} scale={0.35} position={[0, y, 0]} />;
      case "thinking":
        return <mesh ref={indicator} geometry={geoSphere} material={indicatorMat} scale={0.16} position={[0, y, 0]} />;
      case "working":
        return <mesh geometry={geoSphere} material={indicatorMat} scale={0.09} position={[0, y, 0]} />;
      default:
        return null;
    }
  };

  return (
    <group ref={groupRef} onClick={interactive ? handleClick : undefined} {...(interactive ? cursorHandlers : {})}>
      <group position={pose === "desk" ? [0, 0, 0.95] : [0, 0, 0]}>
        <mesh ref={ring} geometry={geoTorus} material={ringMat} scale={1.3} position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh ref={figure} position={[0, 0.95, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial ref={mat} transparent alphaTest={0.1} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        {renderIndicator()}
        {showLabel && (
          <Billboard position={[0, 2.62, 0]}>
            <Text fontSize={0.38} color="#f8fafc" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#0b0f1a">
              {agent.name}
            </Text>
            <Text fontSize={0.22} color={color} anchorX="center" anchorY="middle" position={[0, -0.34, 0]}>
              {STATUS_META[agent.status].label}
            </Text>
          </Billboard>
        )}
      </group>
    </group>
  );
});
