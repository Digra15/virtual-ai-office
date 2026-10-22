import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { AgentInfo } from "@virtual-ai-office/shared";
import { STATUS_META } from "../../utils/status";
import { geoOctahedron, geoSphere, geoTorus } from "../geometries";
import {
  agentCursorHandlers,
  makeAgentClickHandler,
} from "../interaction/selectAgent";
import type { CharacterPreset, ChibiAnimation } from "./characterTypes";
import {
  CELEBRATE_SECONDS,
  FRAME_COUNTS,
  FRAME_FPS,
  PIXEL_ANIMATIONS,
  PIXEL_BLINK_DURATION,
  SPRITE_H,
  SPRITE_W,
  getPixelSheet,
  resolvePixelAnimation,
} from "./pixel/pixelSprites";

/** Convert a raw RGBA pixel buffer into a canvas (DOM side only). */
function bufferToCanvas(buf: Uint8ClampedArray<ArrayBuffer>): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SPRITE_W;
  c.height = SPRITE_H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");
  ctx.putImageData(new ImageData(buf, SPRITE_W, SPRITE_H), 0, 0);
  return c;
}

function makePixelTexture(buf: Uint8ClampedArray<ArrayBuffer>): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(bufferToCanvas(buf));
  // NearestFilter keeps the individual pixels visible ("agak pixel pixel").
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface PixelAvatarProps {
  agent: AgentInfo;
  preset: CharacterPreset;
  /** Status color driving the ring, indicator and label. */
  color: string;
  interactive?: boolean;
  showLabel?: boolean;
  groupRef: React.Ref<THREE.Group>;
  pose?: "desk" | "free";
  animationOverride?: ChibiAnimation | null;
}

/**
 * PixelAvatar — the 2D pixel-art character rendered as a billboard sprite
 * inside the 3D office (2.5D "Paper Mario" style).
 *
 * Frame animation (not rigid transform animation) is what makes the motion
 * read as lively instead of stiff: each activity has its own hand-drawn
 * frame set, advanced on a timer, with periodic blinks overlaid.
 *
 * Status chrome (ring, indicator, name label) and click-to-select wiring
 * are preserved from the old 3D avatar — PROVEN WORKING in production,
 * do not "simplify" this wiring.
 */
export const PixelAvatar = memo(function PixelAvatar({
  agent,
  preset,
  color,
  interactive = true,
  showLabel = true,
  groupRef,
  pose = "desk",
  animationOverride = null,
}: PixelAvatarProps) {
  const status = agent.status;

  // Pre-rendered frame set for this preset (cached per preset).
  const sheet = useMemo(() => getPixelSheet(preset), [preset]);

  // One CanvasTexture per (animation, frame, blink) — built once per preset.
  const textures = useMemo(() => {
    const t = {} as Record<
      ChibiAnimation,
      { open: THREE.CanvasTexture[]; blink: THREE.CanvasTexture[] }
    >;
    for (const anim of PIXEL_ANIMATIONS) {
      const open: THREE.CanvasTexture[] = [];
      const blink: THREE.CanvasTexture[] = [];
      for (let f = 0; f < FRAME_COUNTS[anim]; f++) {
        open.push(makePixelTexture(sheet.get(anim, f, false)));
        blink.push(makePixelTexture(sheet.get(anim, f, true)));
      }
      t[anim] = { open, blink };
    }
    return t;
  }, [sheet]);

  // Dispose GPU textures when the preset changes / unmounts.
  useEffect(() => {
    return () => {
      for (const anim of PIXEL_ANIMATIONS) {
        for (const tex of textures[anim].open) tex.dispose();
        for (const tex of textures[anim].blink) tex.dispose();
      }
    };
  }, [textures]);

  const mat = useRef<THREE.SpriteMaterial>(null);
  const ring = useRef<THREE.Mesh>(null);
  const indicator = useRef<THREE.Mesh>(null);

  // Frame-advance state (refs only — no per-frame React state).
  const animRef = useRef<ChibiAnimation>("idle");
  const frameIdx = useRef(0);
  const acc = useRef(0);
  const lastClock = useRef(0);
  const blinkUntil = useRef(-1);
  const nextBlink = useRef(1.5 + (preset.agentId.length % 7) / 4);
  const celebrateUntil = useRef(-1);
  const prevProgress = useRef<number | null>(null);

  // Queue a celebration when a task completes (progress reaches 100%).
  useEffect(() => {
    const p = typeof agent.progress === "number" ? agent.progress : null;
    if (p !== null && p >= 100 && (prevProgress.current === null || prevProgress.current < 100)) {
      celebrateUntil.current = lastClock.current + CELEBRATE_SECONDS;
    }
    prevProgress.current = p;
  }, [agent.progress]);

  // Clicking any visible part of the character selects the agent (same path
  // as dashboard selection: select + detail panel + camera focus).
  const handleClick = useMemo(
    () => makeAgentClickHandler(agent.id, agent.workstationId),
    [agent.id, agent.workstationId],
  );
  const cursorHandlers = useMemo(() => agentCursorHandlers(), []);

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
    status === "error"
      ? 0.18
      : status === "waiting"
        ? 0.35
        : status === "thinking"
          ? 0.16
          : 0.09;

  // Reset status-chrome transforms when the status changes.
  useEffect(() => {
    if (ring.current) ring.current.scale.set(1.3, 1.3, 1);
    if (indicator.current) {
      indicator.current.visible = true;
      indicator.current.rotation.set(0, 0, 0);
      indicator.current.position.set(0, 2.02, 0);
      indicator.current.scale.setScalar(indicatorBaseScale);
    }
  }, [status, indicatorBaseScale]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    lastClock.current = t;

    // --- sprite frame animation ---
    const celebrating = t < celebrateUntil.current;
    const anim = resolvePixelAnimation(status, animationOverride, celebrating);
    if (anim !== animRef.current) {
      animRef.current = anim;
      frameIdx.current = 0;
      acc.current = 0;
    }
    acc.current += delta;
    const step = 1 / FRAME_FPS[anim];
    const count = FRAME_COUNTS[anim];
    while (acc.current >= step) {
      acc.current -= step;
      frameIdx.current = (frameIdx.current + 1) % count;
    }
    if (t >= nextBlink.current) {
      blinkUntil.current = t + PIXEL_BLINK_DURATION;
      nextBlink.current = t + 2 + Math.random() * 2.5;
    }
    const blinking = t < blinkUntil.current;
    const set = blinking ? textures[anim].blink : textures[anim].open;
    const tex = set[frameIdx.current];
    if (mat.current && mat.current.map !== tex) {
      mat.current.map = tex;
    }

    // --- status chrome animation: ring pulse (thinking), tumbling
    // (waiting), urgent blink (error) ---
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
      indicator.current.scale.setScalar(
        indicatorBaseScale * (1 + Math.max(0, pulse) * 0.35),
      );
    }
  });

  const renderIndicator = () => {
    const y = 2.02;
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
      ref={groupRef}
      onClick={interactive ? handleClick : undefined}
      {...(interactive ? cursorHandlers : {})}
    >
      {/* figure mount: desk = seated at desk, free = centered on the root.
          The sprite always faces the camera (billboard), so the mount only
          carries the positional offset. */}
      <group position={pose === "desk" ? [0, 0, 0.95] : [0, 0, 0]}>
        {/* status ring at base — drives status readability, do not remove */}
        <mesh
          ref={ring}
          geometry={geoTorus}
          material={ringMat}
          scale={1.3}
          position={[0, 0.06, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        {/* 2D pixel-art sprite: 28x36 px, NearestFilter keeps pixels crisp */}
        <sprite position={[0, 0.95, 0]} scale={[1.4, 1.8, 1]}>
          <spriteMaterial
            ref={mat}
            map={textures.idle.open[0]}
            transparent
            alphaTest={0.1}
            depthWrite={false}
          />
        </sprite>
        {renderIndicator()}
        {/* name + status label, always faces the camera */}
        {showLabel && (
          <Billboard position={[0, 2.62, 0]}>
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
              {STATUS_META[agent.status].label}
            </Text>
          </Billboard>
        )}
      </group>
    </group>
  );
});
