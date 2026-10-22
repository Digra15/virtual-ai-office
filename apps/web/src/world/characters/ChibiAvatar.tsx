import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { STATUS_META } from "../../utils/status";
import {
  geoBox,
  geoCapsule,
  geoCone,
  geoCylinder,
  geoOctahedron,
  geoSphere,
  geoTorus,
} from "../geometries";
import {
  matChibiBlush,
  matChibiDark,
  matChibiEyeWhite,
  matChibiGold,
  matChibiMouth,
  matChibiRed,
  matChibiShoe,
  matChibiTie,
  matChibiWhite,
} from "../materials";
import {
  eyeOpenAmount,
  statusToAnimation,
  type CharacterPreset,
  type ChibiAnimation,
  type HairStyle,
} from "./characterTypes";
import {
  agentCursorHandlers,
  makeAgentClickHandler,
} from "../interaction/selectAgent";
import type { AgentInfo } from "@virtual-ai-office/shared";

/** Seconds the celebrate animation plays after a task completes. */
const CELEBRATE_SECONDS = 2.5;

/** Deterministic per-agent hash for staggering blinks. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Hair builders (inner local space, head center ≈ [0, 1.32, 0], r ≈ 0.33)
// ---------------------------------------------------------------------------

function Bangs({ mat }: { mat: THREE.Material }) {
  return (
    <group>
      {[-0.21, -0.07, 0.07, 0.21].map((x, i) => (
        <mesh
          key={i}
          geometry={geoCone}
          material={mat}
          scale={[0.17, 0.3, 0.13]}
          position={[x, 1.6, 0.2]}
          rotation={[2.75, 0, x * -0.6]}
        />
      ))}
    </group>
  );
}

/** Cones radiating outward+up from the crown (spiky / messy styles). */
function CrownSpikes({
  mat,
  count,
  length,
  radius,
  y,
}: {
  mat: THREE.Material;
  count: number;
  length: number;
  radius: number;
  y: number;
}) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + 0.3;
        return (
          <mesh
            key={i}
            geometry={geoCone}
            material={mat}
            scale={[0.15, length, 0.15]}
            position={[Math.cos(a) * radius, y + (i % 2) * 0.05, Math.sin(a) * radius - 0.02]}
            rotation={[Math.sin(a) * 0.85, 0, -Math.cos(a) * 0.85]}
          />
        );
      })}
    </group>
  );
}

function Hair({ style, mat }: { style: HairStyle; mat: THREE.Material }) {
  switch (style) {
    case "hime":
      return (
        <group>
          <mesh geometry={geoSphere} material={mat} scale={[0.72, 0.95, 0.72]} position={[0, 1.18, -0.1]} />
          <Bangs mat={mat} />
          <mesh geometry={geoBox} material={mat} scale={[0.1, 0.52, 0.13]} position={[-0.31, 1.12, 0.1]} />
          <mesh geometry={geoBox} material={mat} scale={[0.1, 0.52, 0.13]} position={[0.31, 1.12, 0.1]} />
        </group>
      );
    case "bob":
      return (
        <group>
          <mesh geometry={geoSphere} material={mat} scale={[0.7, 0.68, 0.7]} position={[0, 1.32, -0.08]} />
          <Bangs mat={mat} />
        </group>
      );
    case "messy":
      return (
        <group>
          <mesh geometry={geoSphere} material={mat} scale={[0.68, 0.6, 0.68]} position={[0, 1.4, -0.04]} />
          <Bangs mat={mat} />
          <CrownSpikes mat={mat} count={6} length={0.3} radius={0.22} y={1.58} />
        </group>
      );
    case "wavy":
      return (
        <group>
          <mesh geometry={geoSphere} material={mat} scale={[0.72, 0.9, 0.72]} position={[0, 1.2, -0.1]} />
          <Bangs mat={mat} />
          {[-1, 1].map((s) => (
            <group key={s}>
              {[1.08, 0.88, 0.7].map((wy, i) => (
                <mesh
                  key={i}
                  geometry={geoSphere}
                  material={mat}
                  scale={0.17 - i * 0.02}
                  position={[s * (0.33 + i * 0.015), wy, -0.06]}
                />
              ))}
            </group>
          ))}
        </group>
      );
    case "twintails":
      return (
        <group>
          <mesh geometry={geoSphere} material={mat} scale={[0.68, 0.62, 0.68]} position={[0, 1.42, -0.02]} />
          <Bangs mat={mat} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh
                geometry={geoCone}
                material={mat}
                scale={[0.24, 0.78, 0.24]}
                position={[s * 0.42, 1.0, -0.08]}
                rotation={[0.25, 0, s * -2.69]}
              />
              <mesh
                geometry={geoTorus}
                material={matChibiRed}
                scale={0.13}
                position={[s * 0.33, 1.38, -0.02]}
              />
            </group>
          ))}
        </group>
      );
    case "spiky":
      return (
        <group>
          <mesh geometry={geoSphere} material={mat} scale={[0.66, 0.58, 0.66]} position={[0, 1.4, -0.04]} />
          <Bangs mat={mat} />
          <CrownSpikes mat={mat} count={8} length={0.36} radius={0.24} y={1.6} />
        </group>
      );
    case "ponytail":
      return (
        <group>
          <mesh geometry={geoSphere} material={mat} scale={[0.68, 0.62, 0.68]} position={[0, 1.42, -0.04]} />
          <Bangs mat={mat} />
          <mesh
            geometry={geoCapsule}
            material={mat}
            scale={[0.2, 0.42, 0.2]}
            position={[0, 1.42, -0.38]}
            rotation={[-1.0, 0, 0]}
          />
          <mesh geometry={geoTorus} material={matChibiRed} scale={0.13} position={[0, 1.58, -0.27]} />
        </group>
      );
    case "short":
      return (
        <group>
          <mesh geometry={geoSphere} material={mat} scale={[0.66, 0.58, 0.66]} position={[0, 1.42, -0.03]} />
          <Bangs mat={mat} />
        </group>
      );
  }
}

// ---------------------------------------------------------------------------
// Outfits (body mesh is rendered by the figure; this adds the extras)
// ---------------------------------------------------------------------------

function OutfitExtras({
  style,
  primary,
  secondary,
}: {
  style: CharacterPreset["outfitStyle"];
  primary: THREE.Material;
  secondary: THREE.Material;
}) {
  switch (style) {
    case "sweater":
      return (
        <group>
          <mesh geometry={geoCone} material={secondary} scale={[0.44, 0.36, 0.44]} position={[0, 0.52, 0.02]} />
          <mesh geometry={geoTorus} material={secondary} scale={0.26} position={[0, 1.08, 0]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      );
    case "vest":
      return (
        <group>
          {/* vest shell over the shirt body */}
          <mesh geometry={geoCapsule} material={secondary} scale={[0.32, 0.36, 0.3]} position={[0, 0.82, -0.01]} />
          <mesh geometry={geoBox} material={primary} scale={[0.2, 0.4, 0.06]} position={[0, 0.84, 0.2]} />
          <mesh geometry={geoBox} material={matChibiTie} scale={[0.07, 0.3, 0.03]} position={[0, 0.86, 0.26]} />
        </group>
      );
    case "hoodie":
      return (
        <group>
          <mesh geometry={geoSphere} material={secondary} scale={[0.34, 0.3, 0.22]} position={[0, 1.12, -0.22]} />
          <mesh geometry={geoBox} material={secondary} scale={[0.24, 0.16, 0.07]} position={[0, 0.62, 0.24]} />
        </group>
      );
    case "cozy":
      return (
        <group>
          <mesh geometry={geoTorus} material={secondary} scale={0.3} position={[0, 1.1, 0]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      );
    case "jacket":
      return (
        <group>
          <mesh geometry={geoBox} material={secondary} scale={[0.14, 0.44, 0.3]} position={[-0.13, 0.84, 0.03]} rotation={[0, 0, 0.08]} />
          <mesh geometry={geoBox} material={secondary} scale={[0.14, 0.44, 0.3]} position={[0.13, 0.84, 0.03]} rotation={[0, 0, -0.08]} />
          <mesh geometry={geoCone} material={secondary} scale={[0.44, 0.36, 0.44]} position={[0, 0.52, 0.02]} />
        </group>
      );
    case "shirtTie":
      return (
        <group>
          <mesh geometry={geoBox} material={matChibiTie} scale={[0.08, 0.34, 0.03]} position={[0, 0.88, 0.26]} />
        </group>
      );
    case "workJacket":
      return (
        <group>
          <mesh geometry={geoBox} material={secondary} scale={[0.34, 0.08, 0.32]} position={[0, 0.6, 0]} />
          <mesh geometry={geoBox} material={secondary} scale={[0.1, 0.1, 0.03]} position={[0.1, 0.92, 0.25]} />
        </group>
      );
    case "uniform":
      return (
        <group>
          <mesh geometry={geoBox} material={secondary} scale={[0.12, 0.04, 0.1]} position={[-0.2, 1.06, 0]} />
          <mesh geometry={geoBox} material={secondary} scale={[0.12, 0.04, 0.1]} position={[0.2, 1.06, 0]} />
          <mesh geometry={geoCylinder} material={secondary} scale={[0.3, 0.1, 0.3]} position={[0, 1.1, 0]} />
        </group>
      );
  }
}

// ---------------------------------------------------------------------------
// Accessories
// ---------------------------------------------------------------------------

function Accessory({
  kind,
  outfitSecondary,
}: {
  kind: CharacterPreset["accessory"];
  outfitSecondary: THREE.Material;
}) {
  switch (kind) {
    case "ribbon":
      return (
        <group position={[0.3, 1.62, 0.05]} rotation={[0, 0, -0.4]}>
          <mesh geometry={geoSphere} material={matChibiRed} scale={0.07} />
          <mesh geometry={geoCone} material={matChibiRed} scale={[0.1, 0.2, 0.06]} position={[-0.1, 0.02, 0]} rotation={[0, 0, 1.2]} />
          <mesh geometry={geoCone} material={matChibiRed} scale={[0.1, 0.2, 0.06]} position={[0.1, 0.02, 0]} rotation={[0, 0, -1.2]} />
        </group>
      );
    case "roundGlasses":
      return (
        <group>
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              geometry={geoTorus}
              material={matChibiDark}
              scale={0.13}
              position={[s * 0.135, 1.36, 0.3]}
            />
          ))}
          <mesh geometry={geoBox} material={matChibiDark} scale={[0.07, 0.02, 0.02]} position={[0, 1.37, 0.3]} />
        </group>
      );
    case "headphones":
      return (
        <group>
          <mesh geometry={geoTorus} material={matChibiDark} scale={[0.72, 0.62, 0.9]} position={[0, 1.5, -0.04]} />
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              geometry={geoCylinder}
              material={outfitSecondary}
              scale={[0.16, 0.12, 0.16]}
              position={[s * 0.36, 1.34, 0]}
              rotation={[0, 0, Math.PI / 2]}
            />
          ))}
        </group>
      );
    case "beret":
      return (
        <mesh
          geometry={geoCylinder}
          material={outfitSecondary}
          scale={[0.44, 0.12, 0.44]}
          position={[0.1, 1.68, -0.02]}
          rotation={[0, 0, -0.18]}
        />
      );
    case "starPin":
      return (
        <mesh
          geometry={geoSphere}
          material={matChibiGold}
          scale={[0.09, 0.09, 0.04]}
          position={[-0.29, 1.56, 0.14]}
          rotation={[0, 0, 0.5]}
        />
      );
    case "rectGlasses":
      return (
        <group>
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              geometry={geoTorus}
              material={matChibiDark}
              scale={[0.17, 0.11, 0.5]}
              position={[s * 0.135, 1.36, 0.3]}
            />
          ))}
          <mesh geometry={geoBox} material={matChibiDark} scale={[0.07, 0.02, 0.02]} position={[0, 1.37, 0.3]} />
        </group>
      );
    case "cap":
      return (
        <group>
          <mesh geometry={geoSphere} material={outfitSecondary} scale={[0.6, 0.36, 0.6]} position={[0, 1.56, 0.02]} />
          <mesh geometry={geoBox} material={outfitSecondary} scale={[0.34, 0.04, 0.32]} position={[0, 1.52, 0.36]} />
          <mesh geometry={geoSphere} material={matChibiRed} scale={0.05} position={[0, 1.74, 0.02]} />
        </group>
      );
    case "headsetMic":
      return (
        <group>
          <mesh geometry={geoTorus} material={matChibiDark} scale={[0.7, 0.6, 0.9]} position={[0, 1.5, -0.04]} />
          <mesh
            geometry={geoCylinder}
            material={matChibiDark}
            scale={[0.15, 0.11, 0.15]}
            position={[0.36, 1.34, 0]}
            rotation={[0, 0, Math.PI / 2]}
          />
          <mesh
            geometry={geoCylinder}
            material={matChibiDark}
            scale={[0.035, 0.3, 0.035]}
            position={[0.3, 1.22, 0.16]}
            rotation={[0.9, 0, 0.5]}
          />
          <mesh geometry={geoSphere} material={matChibiRed} scale={0.045} position={[0.22, 1.14, 0.28]} />
        </group>
      );
    case "none":
      return null;
  }
}

// ---------------------------------------------------------------------------
// ChibiFigure — the animated character (no scene chrome, no interaction)
// ---------------------------------------------------------------------------

interface ChibiFigureProps {
  preset: CharacterPreset;
  status: AgentInfo["status"];
  progress: number | null;
  /**
   * Override the status-derived animation (e.g. "walking" while the
   * movement system drives the agent, "meeting" while seated in a
   * meeting). Null = use the status mapping. Celebration on task
   * completion still takes precedence over the override.
   */
  animationOverride?: ChibiAnimation | null;
}

const BASE_HEAD_POS: [number, number, number] = [0, 1.32, 0.02];
const BASE_ARM_L: [number, number, number] = [-0.55, 0, 0.12];
const BASE_ARM_R: [number, number, number] = [-0.55, 0, -0.12];

export const ChibiFigure = memo(function ChibiFigure({
  preset,
  status,
  progress,
  animationOverride = null,
}: ChibiFigureProps) {
  const rootG = useRef<THREE.Group>(null);
  const torsoG = useRef<THREE.Group>(null);
  const bodyM = useRef<THREE.Mesh>(null);
  const headG = useRef<THREE.Group>(null);
  const eyeLG = useRef<THREE.Group>(null);
  const eyeRG = useRef<THREE.Group>(null);
  const armLP = useRef<THREE.Group>(null);
  const armRP = useRef<THREE.Group>(null);
  const legLP = useRef<THREE.Group>(null);
  const legRP = useRef<THREE.Group>(null);

  const hairMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: preset.hairColor, roughness: 0.55 }),
    [preset.hairColor],
  );
  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: preset.skinTone, roughness: 0.65 }),
    [preset.skinTone],
  );
  const irisMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: preset.eyeColor,
        emissive: new THREE.Color(preset.eyeColor),
        emissiveIntensity: 0.25,
        roughness: 0.2,
      }),
    [preset.eyeColor],
  );
  const outfitMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: preset.outfitPrimary, roughness: 0.8 }),
    [preset.outfitPrimary],
  );
  const outfit2Mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: preset.outfitSecondary, roughness: 0.8 }),
    [preset.outfitSecondary],
  );

  const baseBodyScale: [number, number, number] = useMemo(
    () =>
      preset.outfitStyle === "cozy" ? [0.34, 0.38, 0.32] : [0.3, 0.34, 0.28],
    [preset.outfitStyle],
  );

  // --- blink + celebrate state (refs only — no per-frame React state) ---
  const blinkSeed = useMemo(() => hashId(preset.agentId), [preset.agentId]);
  const blinkStart = useRef(-10);
  const nextBlink = useRef(1.5 + (blinkSeed % 15) / 10);
  const blinkCount = useRef(0);
  const celebrateStart = useRef(-10);
  const celebrateQueued = useRef(false);
  const prevProgress = useRef<number | null>(null);
  const animRef = useRef<ChibiAnimation>("idle");
  const animStart = useRef(0);

  // Queue a celebration when a task completes (progress reaches 100%).
  useEffect(() => {
    if (
      typeof progress === "number" &&
      progress >= 100 &&
      (prevProgress.current === null || prevProgress.current < 100)
    ) {
      celebrateQueued.current = true;
    }
    prevProgress.current = typeof progress === "number" ? progress : null;
  }, [status, progress]);

  const resetPose = () => {
    if (rootG.current) {
      rootG.current.position.set(0, 0, 0);
      rootG.current.rotation.set(0, 0, 0);
    }
    if (torsoG.current) {
      torsoG.current.position.set(0, 0, 0);
      torsoG.current.rotation.set(0, 0, 0);
    }
    if (bodyM.current) bodyM.current.scale.set(...baseBodyScale);
    if (headG.current) {
      headG.current.position.set(...BASE_HEAD_POS);
      headG.current.rotation.set(0, 0, 0);
    }
    if (eyeLG.current) eyeLG.current.scale.set(1, 1, 1);
    if (eyeRG.current) eyeRG.current.scale.set(1, 1, 1);
    if (armLP.current) armLP.current.rotation.set(...BASE_ARM_L);
    if (armRP.current) armRP.current.rotation.set(...BASE_ARM_R);
    if (legLP.current) legLP.current.rotation.set(0, 0, 0);
    if (legRP.current) legRP.current.rotation.set(0, 0, 0);
  };

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Resolve the animation: celebration overrides status mapping briefly.
    if (celebrateQueued.current) {
      celebrateQueued.current = false;
      celebrateStart.current = t;
    }
    const celebrating =
      celebrateStart.current >= 0 && t - celebrateStart.current < CELEBRATE_SECONDS;
    const anim: ChibiAnimation =
      celebrating ? "celebrate" : (animationOverride ?? statusToAnimation(status));
    if (anim !== animRef.current) {
      resetPose();
      animRef.current = anim;
      animStart.current = t;
    }

    // Blink runs in EVERY animation — it's what makes them feel alive.
    if (t >= nextBlink.current) {
      blinkStart.current = t;
      blinkCount.current += 1;
      nextBlink.current = t + 2.4 + ((blinkSeed + blinkCount.current * 37) % 20) / 10;
    }
    const open = Math.max(0.08, eyeOpenAmount(t, blinkStart.current));
    if (eyeLG.current) eyeLG.current.scale.y = open;
    if (eyeRG.current) eyeRG.current.scale.y = open;

    switch (anim) {
      case "idle": {
        if (bodyM.current)
          bodyM.current.scale.set(
            baseBodyScale[0],
            baseBodyScale[1] * (1 + Math.sin(t * 1.8) * 0.035),
            baseBodyScale[2],
          );
        if (torsoG.current) torsoG.current.rotation.z = Math.sin(t * 0.9) * 0.045;
        if (headG.current) {
          headG.current.rotation.y = Math.sin(t * 0.5) * 0.12;
          headG.current.position.y = BASE_HEAD_POS[1] + Math.sin(t * 1.8) * 0.015;
        }
        break;
      }
      case "typing": {
        const w = t * 7;
        if (armLP.current) armLP.current.rotation.x = BASE_ARM_L[0] + Math.sin(w) * 0.38;
        if (armRP.current) armRP.current.rotation.x = BASE_ARM_R[0] + Math.sin(w + Math.PI) * 0.38;
        if (headG.current) {
          headG.current.rotation.x = 0.14 + Math.sin(w) * 0.05;
          headG.current.position.y = BASE_HEAD_POS[1] + Math.sin(w) * 0.02;
        }
        if (torsoG.current) torsoG.current.position.y = Math.sin(w) * 0.02;
        break;
      }
      case "thinking": {
        if (headG.current) {
          headG.current.rotation.z = Math.sin(t * 1.3) * 0.28;
          headG.current.rotation.x = -0.08;
        }
        if (armRP.current) {
          armRP.current.rotation.x = -1.7 + Math.sin(t * 1.3) * 0.08;
          armRP.current.rotation.z = -0.35;
        }
        if (armLP.current) armLP.current.rotation.x = -0.35;
        if (torsoG.current) torsoG.current.rotation.y = Math.sin(t * 0.8) * 0.06;
        break;
      }
      case "walking": {
        const w = t * 5;
        if (legLP.current) legLP.current.rotation.x = Math.sin(w) * 0.55;
        if (legRP.current) legRP.current.rotation.x = Math.sin(w + Math.PI) * 0.55;
        if (armLP.current) armLP.current.rotation.x = -0.2 + Math.sin(w + Math.PI) * 0.45;
        if (armRP.current) armRP.current.rotation.x = -0.2 + Math.sin(w) * 0.45;
        if (rootG.current) rootG.current.position.y = Math.abs(Math.sin(w)) * 0.07;
        if (headG.current) headG.current.rotation.z = Math.sin(w) * 0.05;
        break;
      }
      case "meeting": {
        if (torsoG.current) torsoG.current.rotation.x = -0.04;
        if (armLP.current) armLP.current.rotation.set(-0.9, 0, 0.5);
        if (armRP.current) armRP.current.rotation.set(-0.9, 0, -0.5);
        if (headG.current) {
          const nodT = t % 3.2;
          headG.current.rotation.x =
            nodT < 0.5 ? Math.sin((nodT / 0.5) * Math.PI) * 0.22 : 0;
          headG.current.rotation.y = Math.sin(t * 0.6) * 0.1;
        }
        break;
      }
      case "celebrate": {
        const ct = t - animStart.current;
        const fade = Math.max(0.15, 1 - ct / CELEBRATE_SECONDS);
        if (rootG.current) {
          rootG.current.position.y = Math.abs(Math.sin(ct * 6)) * 0.22 * fade;
          rootG.current.rotation.y = ct * 4 * fade;
        }
        if (armLP.current) armLP.current.rotation.set(-0.2, 0, 2.5);
        if (armRP.current) armRP.current.rotation.set(-0.2, 0, -2.5);
        if (headG.current) headG.current.rotation.z = Math.sin(ct * 6) * 0.15;
        break;
      }
    }
  });

  return (
    <group ref={rootG}>
      {/* legs */}
      <group ref={legLP} position={[-0.1, 0.58, 0.06]}>
        <mesh geometry={geoBox} material={outfit2Mat} scale={[0.14, 0.15, 0.38]} position={[0, -0.02, 0.15]} />
        <mesh geometry={geoCapsule} material={skinMat} scale={[0.1, 0.22, 0.1]} position={[0, -0.28, 0.3]} />
        <mesh geometry={geoBox} material={matChibiShoe} scale={[0.13, 0.1, 0.22]} position={[0, -0.46, 0.34]} />
      </group>
      <group ref={legRP} position={[0.1, 0.58, 0.06]}>
        <mesh geometry={geoBox} material={outfit2Mat} scale={[0.14, 0.15, 0.38]} position={[0, -0.02, 0.15]} />
        <mesh geometry={geoCapsule} material={skinMat} scale={[0.1, 0.22, 0.1]} position={[0, -0.28, 0.3]} />
        <mesh geometry={geoBox} material={matChibiShoe} scale={[0.13, 0.1, 0.22]} position={[0, -0.46, 0.34]} />
      </group>
      {/* torso + arms + head */}
      <group ref={torsoG}>
        <mesh
          ref={bodyM}
          geometry={geoCapsule}
          material={outfitMat}
          scale={baseBodyScale}
          position={[0, 0.82, 0]}
          castShadow
        />
        <OutfitExtras style={preset.outfitStyle} primary={outfitMat} secondary={outfit2Mat} />
        <group ref={armLP} position={[-0.2, 1.02, 0.02]} rotation={BASE_ARM_L}>
          <mesh geometry={geoCapsule} material={outfitMat} scale={[0.1, 0.3, 0.1]} position={[0, -0.16, 0.02]} castShadow />
          <mesh geometry={geoSphere} material={skinMat} scale={0.09} position={[0, -0.34, 0.03]} />
        </group>
        <group ref={armRP} position={[0.2, 1.02, 0.02]} rotation={BASE_ARM_R}>
          <mesh geometry={geoCapsule} material={outfitMat} scale={[0.1, 0.3, 0.1]} position={[0, -0.16, 0.02]} castShadow />
          <mesh geometry={geoSphere} material={skinMat} scale={0.09} position={[0, -0.34, 0.03]} />
        </group>
        {/* neck */}
        <mesh geometry={geoCylinder} material={skinMat} scale={[0.09, 0.08, 0.09]} position={[0, 1.04, 0]} />
        {/* big chibi head */}
        <group ref={headG} position={BASE_HEAD_POS}>
          <mesh geometry={geoSphere} material={skinMat} scale={0.66} castShadow />
          <mesh geometry={geoSphere} material={skinMat} scale={0.1} position={[-0.3, 0, 0]} />
          <mesh geometry={geoSphere} material={skinMat} scale={0.1} position={[0.3, 0, 0]} />
          {/* huge sparkling anime eyes */}
          <group ref={eyeLG} position={[-0.135, 0.04, 0]}>
            <mesh geometry={geoSphere} material={matChibiEyeWhite} scale={[0.17, 0.21, 0.1]} position={[0, 0, 0.28]} />
            <mesh geometry={geoSphere} material={irisMat} scale={[0.115, 0.15, 0.06]} position={[0, 0, 0.335]} />
            <mesh geometry={geoSphere} material={matChibiWhite} scale={0.045} position={[0.04, 0.055, 0.375]} />
          </group>
          <group ref={eyeRG} position={[0.135, 0.04, 0]}>
            <mesh geometry={geoSphere} material={matChibiEyeWhite} scale={[0.17, 0.21, 0.1]} position={[0, 0, 0.28]} />
            <mesh geometry={geoSphere} material={irisMat} scale={[0.115, 0.15, 0.06]} position={[0, 0, 0.335]} />
            <mesh geometry={geoSphere} material={matChibiWhite} scale={0.045} position={[-0.04, 0.055, 0.375]} />
          </group>
          {/* mouth + blush */}
          <mesh geometry={geoBox} material={matChibiMouth} scale={[0.07, 0.028, 0.02]} position={[0, -0.085, 0.315]} />
          <mesh geometry={geoSphere} material={matChibiBlush} scale={[0.07, 0.045, 0.02]} position={[-0.21, -0.03, 0.245]} />
          <mesh geometry={geoSphere} material={matChibiBlush} scale={[0.07, 0.045, 0.02]} position={[0.21, -0.03, 0.245]} />
          <Hair style={preset.hairStyle} mat={hairMat} />
          <Accessory kind={preset.accessory} outfitSecondary={outfit2Mat} />
        </group>
      </group>
    </group>
  );
});

// ---------------------------------------------------------------------------
// ChibiAvatar — positioned character + status chrome + interaction
// ---------------------------------------------------------------------------

interface ChibiAvatarProps {
  agent: AgentInfo;
  preset: CharacterPreset;
  /** Status color driving the ring, indicator and label. */
  color: string;
  /** Enable click-to-select + pointer cursor. Disable for static previews. */
  interactive?: boolean;
  /** Show the floating name + status label. */
  showLabel?: boolean;
  /**
   * Ref to the outer group. The movement system (`world/movement.ts`) owns
   * the group's position/rotation imperatively — they are intentionally NOT
   * React props, so per-frame walking never triggers re-renders and React
   * never stomps the controller's transforms.
   */
  groupRef?: React.Ref<THREE.Group>;
  /**
   * How the figure is mounted on its root:
   * - "desk": seated at a desk (offset toward the chair, facing the monitor)
   * - "free": standing or sitting freely (centered on the root)
   */
  pose?: "desk" | "free";
  /**
   * Override the status-derived animation ("walking" while moving,
   * "meeting" while in a meeting). Null = status mapping. Celebration on
   * task completion still takes precedence.
   */
  animationOverride?: ChibiAnimation | null;
}

export const ChibiAvatar = memo(function ChibiAvatar({
  agent,
  preset,
  color,
  interactive = true,
  showLabel = true,
  groupRef,
  pose = "desk",
  animationOverride = null,
}: ChibiAvatarProps) {
  const ring = useRef<THREE.Mesh>(null);
  const indicator = useRef<THREE.Mesh>(null);

  const status = agent.status;

  // Clicking any visible part of the character selects the agent (same path
  // as dashboard selection: select + detail panel + camera focus).
  // PROVEN WORKING in production — do not "simplify" this wiring.
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

  // Base indicator scale per status (must match renderIndicator below).
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

  // Status chrome animation: ring pulse (thinking), tumbling (waiting),
  // urgent blink (error). Runs in its own useFrame, separate from the figure.
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
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
      {/* figure mount: desk = seated at desk (offset + turned to monitor),
          free = standing/sitting centered on the root */}
      <group
        position={pose === "desk" ? [0, 0, 0.95] : [0, 0, 0]}
        rotation={[0, pose === "desk" ? Math.PI : 0, 0]}
      >
        {/* status ring at base — drives status readability, do not remove */}
        <mesh
          ref={ring}
          geometry={geoTorus}
          material={ringMat}
          scale={1.3}
          position={[0, 0.06, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <ChibiFigure
          preset={preset}
          status={status}
          progress={agent.progress}
          animationOverride={animationOverride}
        />
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
