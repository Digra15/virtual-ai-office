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
import { movement } from "../movement";
import type {
  CharacterPreset,
  ChibiAnimation,
  SpriteDirection,
} from "./characterTypes";
import { selectSpriteDirection, wrapAngle } from "./characterTypes";
import { isInMusola } from "./facing";
import { prayerWearFor } from "./characterPresets";
import {
  CELEBRATE_SECONDS,
  FRAME_COUNTS,
  FRAME_FPS,
  PIXEL_BLINK_DURATION,
  SPRITE_H,
  SPRITE_W,
  getPixelFrame,
  resolvePixelAnimation,
  type PrayerVariant,
} from "./pixel/pixelSprites";

/** Scratch vector for the avatar's world position (no per-frame alloc). */
const tmpV = new THREE.Vector3();

/**
 * Convert a raw RGBA pixel buffer into a canvas (DOM side only).
 * When `mirror` is set the image is flipped horizontally — used for the
 * side view when the camera is on the character's other side.
 */
function bufferToCanvas(
  buf: Uint8ClampedArray<ArrayBuffer>,
  mirror: boolean,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SPRITE_W;
  c.height = SPRITE_H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");
  const src = document.createElement("canvas");
  src.width = SPRITE_W;
  src.height = SPRITE_H;
  const sctx = src.getContext("2d");
  if (!sctx) throw new Error("2d canvas context unavailable");
  sctx.putImageData(new ImageData(buf, SPRITE_W, SPRITE_H), 0, 0);
  if (mirror) {
    ctx.translate(SPRITE_W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, 0, 0);
  return c;
}

function makePixelTexture(
  buf: Uint8ClampedArray<ArrayBuffer>,
  mirror: boolean,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(bufferToCanvas(buf, mirror));
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
  groupRef: { current: THREE.Group | null };
  pose?: "desk" | "free";
  animationOverride?: ChibiAnimation | null;
}

/**
 * PixelAvatar — the 2D pixel-art character rendered inside the 3D office
 * (2.5D "Paper Mario" style).
 *
 * 2.5D DIRECTIONAL SPRITES: the figure is a plane that yaws around Y to
 * face the camera (never edge-on), but the TEXTURE is picked from
 * {front, back, side} by the angle between the agent's facing vector and
 * the camera direction. A desk worker seen from the side shows their side
 * profile facing the computer — not staring at the camera.
 *
 * Facing rules (see world/characters/facing.ts): the movement registry
 * owns group.rotation.y (direction of travel while walking, desk rotation
 * while seated). The visual facing adds PI when pose === "desk" because a
 * seated character's nose points at the monitor (desk-local −z).
 *
 * MUSOLA: when the agent's physical position is inside the musola it
 * plays the "praying" animation in its prayer outfit (mukena for
 * female-coded characters, sarung + peci for male-coded ones).
 *
 * Frame animation (not rigid transform animation) is what makes the
 * motion read as lively instead of stiff: each activity has its own
 * hand-drawn frame set, advanced on a timer, with periodic blinks overlaid.
 * Textures are generated LAZILY per (direction, animation, frame, blink,
 * mirror, prayer) on first use and cached — the scene never pays for
 * views it doesn't show.
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

  // Lazy GPU texture cache: one CanvasTexture per
  // (direction, animation, frame, blink, mirror, prayer) — built on first
  // use inside useFrame, disposed when the preset changes / unmounts.
  const texCache = useRef(new Map<string, THREE.CanvasTexture>());
  const getTexture = (
    dir: SpriteDirection,
    anim: ChibiAnimation,
    frame: number,
    blink: boolean,
    mirror: boolean,
    prayer: PrayerVariant,
  ): THREE.CanvasTexture => {
    const key = `${dir}|${anim}|${frame}|${blink ? 1 : 0}|${mirror ? 1 : 0}|${prayer ?? "none"}`;
    let tex = texCache.current.get(key);
    if (!tex) {
      tex = makePixelTexture(
        getPixelFrame(preset, dir, anim, frame, blink, prayer),
        mirror,
      );
      texCache.current.set(key, tex);
    }
    return tex;
  };

  // Dispose GPU textures when the preset changes / unmounts.
  useEffect(() => {
    const cache = texCache.current;
    return () => {
      for (const tex of cache.values()) tex.dispose();
      cache.clear();
    };
  }, [preset]);

  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const figure = useRef<THREE.Mesh>(null);
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

    // --- prayer trigger: physically inside the musola and not walking
    // through it → reverent prayer state + prayer outfit. Position-based,
    // so it works however the agent got there (wander, meeting, manual).
    const inMusola = isInMusola(agent.id);

    // --- sprite frame animation ---
    const celebrating = t < celebrateUntil.current;
    const baseAnim = resolvePixelAnimation(
      status,
      animationOverride,
      celebrating,
      false,
    );
    const praying =
      inMusola && !movement.isMoving(agent.id) && baseAnim !== "walking";
    const anim = praying ? "praying" : baseAnim;
    const prayer: PrayerVariant = praying ? prayerWearFor(preset) : null;
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

    // --- 2.5D directional texture selection + Y-only billboarding ---
    let dir: SpriteDirection = "front";
    let mirror = false;
    const g = groupRef.current;
    if (g) {
      g.getWorldPosition(tmpV);
      const camAz = Math.atan2(
        state.camera.position.x - tmpV.x,
        state.camera.position.z - tmpV.z,
      );
      const facing = g.rotation.y;
      // Yaw the plane toward the camera (never edge-on)...
      if (figure.current) {
        figure.current.rotation.y = wrapAngle(camAz - facing);
      }
      // ...but pick the TEXTURE from the agent's visual facing: a seated
      // agent's nose points at the monitor (desk-local −z = +PI).
      const visualFacing = wrapAngle(
        facing + (pose === "desk" ? Math.PI : 0),
      );
      const view = selectSpriteDirection(visualFacing, camAz);
      dir = view.direction;
      mirror = view.mirror;
    }
    const tex = getTexture(
      dir,
      anim,
      frameIdx.current,
      blinking,
      mirror,
      prayer,
    );
    if (mat.current && mat.current.map !== tex) {
      // needsUpdate only matters for the null → texture transition
      // (shader define flip); texture-to-texture swaps are free.
      const firstMap = mat.current.map == null;
      mat.current.map = tex;
      if (firstMap) mat.current.needsUpdate = true;
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
          The plane yaws toward the camera each frame (Y-billboard); the
          texture direction comes from the agent's visual facing. */}
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
        {/* 2D pixel-art figure: 48x48 px plane, Y-only billboard,
            NearestFilter keeps pixels crisp. meshBasicMaterial stays
            readable under the day/night rig (same as the old sprite). */}
        <mesh ref={figure} position={[0, 0.92, 0]}>
          <planeGeometry args={[1.7, 1.7]} />
          <meshBasicMaterial
            ref={mat}
            transparent
            alphaTest={0.1}
            depthWrite={false}
          />
        </mesh>
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
