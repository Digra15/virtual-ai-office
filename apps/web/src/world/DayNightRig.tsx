/**
 * Day/night lighting rig for the 3D office (rendered inside the Canvas).
 *
 * - Exactly ONE shadow-casting light: warm sun by day, cool moonlight by
 *   night (same directional light, colors/position/intensity lerped).
 * - ambient + hemisphere fill, lerped too.
 * - scene.background + scene.fog color: day blue <-> night near-black.
 * - Night interior warmth: 3 shadowless warm pointLights (open workspace,
 *   lounge, musola) so the scene stays clearly visible and attractive at
 *   night — a guard against black-viewport-class bugs.
 * - All transitions ease over ~1s (exponential lerp in useFrame).
 *
 * The 2D pixel-art agents use THREE.SpriteMaterial (unlit) — they stay
 * visible automatically; no action needed here.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useDayNightStore } from "../stores/useDayNightStore";
import { FLOOR_HEIGHT } from "./building/floorPlan";

const DAY_BG = "#87b5e0";
const NIGHT_BG = "#060a14";

/** Warm interior lights (no shadows, low cost): [x, y, z]. */
const INTERIOR_LIGHTS: Array<[number, number, number]> = [
  [0, 2.8, 1], // open workspace
  [9, FLOOR_HEIGHT + 2.8, -5], // lounge
  [-11, FLOOR_HEIGHT + 2.8, -5], // musola
];

interface RigTargets {
  bg: THREE.Color;
  dirColor: THREE.Color;
  dirIntensity: number;
  dirPos: THREE.Vector3;
  ambColor: THREE.Color;
  ambIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  interiorIntensity: number;
}

function makeTargets(night: boolean): RigTargets {
  return night
    ? {
        bg: new THREE.Color(NIGHT_BG),
        dirColor: new THREE.Color("#8fb4ff"),
        dirIntensity: 0.4,
        dirPos: new THREE.Vector3(-12, 20, -8),
        ambColor: new THREE.Color("#93a7d8"),
        ambIntensity: 0.22,
        hemiSky: new THREE.Color("#1a2340"),
        hemiGround: new THREE.Color("#05070d"),
        hemiIntensity: 0.3,
        interiorIntensity: 30,
      }
    : {
        bg: new THREE.Color(DAY_BG),
        dirColor: new THREE.Color("#fff1d6"),
        dirIntensity: 1.5,
        dirPos: new THREE.Vector3(14, 22, 10),
        ambColor: new THREE.Color("#ffffff"),
        ambIntensity: 0.5,
        hemiSky: new THREE.Color("#bcd6f5"),
        hemiGround: new THREE.Color("#3a4250"),
        hemiIntensity: 0.4,
        interiorIntensity: 0,
      };
}

export const DayNightRig = memo(function DayNightRig() {
  const isNight = useDayNightStore((s) => s.isNight);
  const scene = useThree((s) => s.scene);

  // Snapshot the mode at mount so the first frame never flashes the wrong sky.
  const [initialNight] = useState(() => useDayNightStore.getState().isNight);

  const dirRef = useRef<THREE.DirectionalLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const pointRefs = useRef<Array<THREE.PointLight | null>>([]);
  const bgRef = useRef<THREE.Color | null>(null);

  // Current (lerped) values — start exactly at the mount-time targets.
  const cur = useRef<RigTargets | null>(null);
  if (!cur.current) cur.current = makeTargets(initialNight);
  const target = useMemo(() => makeTargets(isNight), [isNight]);

  // scene.background + scene.fog share one Color instance we lerp in useFrame.
  useEffect(() => {
    const bg = new THREE.Color(initialNight ? NIGHT_BG : DAY_BG);
    const fog = new THREE.Fog(bg.getHex(), 70, 170);
    fog.color = bg; // share the instance: one lerp drives both
    bgRef.current = bg;
    scene.background = bg;
    scene.fog = fog;
    return () => {
      scene.background = null;
      scene.fog = null;
      bgRef.current = null;
    };
  }, [scene]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const k = 1 - Math.exp(-3 * dt); // ~1s ease
    const c = cur.current;
    if (!c) return;
    const t = target;

    c.bg.lerp(t.bg, k);
    c.dirColor.lerp(t.dirColor, k);
    c.dirPos.lerp(t.dirPos, k);
    c.dirIntensity += (t.dirIntensity - c.dirIntensity) * k;
    c.ambColor.lerp(t.ambColor, k);
    c.ambIntensity += (t.ambIntensity - c.ambIntensity) * k;
    c.hemiSky.lerp(t.hemiSky, k);
    c.hemiGround.lerp(t.hemiGround, k);
    c.hemiIntensity += (t.hemiIntensity - c.hemiIntensity) * k;
    c.interiorIntensity += (t.interiorIntensity - c.interiorIntensity) * k;

    if (bgRef.current) bgRef.current.copy(c.bg);
    const dir = dirRef.current;
    if (dir) {
      dir.color.copy(c.dirColor);
      dir.position.copy(c.dirPos);
      dir.intensity = c.dirIntensity;
    }
    const amb = ambRef.current;
    if (amb) {
      amb.color.copy(c.ambColor);
      amb.intensity = c.ambIntensity;
    }
    const hemi = hemiRef.current;
    if (hemi) {
      hemi.color.copy(c.hemiSky);
      hemi.groundColor.copy(c.hemiGround);
      hemi.intensity = c.hemiIntensity;
    }
    for (const p of pointRefs.current) {
      if (p) p.intensity = c.interiorIntensity;
    }
  });

  const init = cur.current as RigTargets;

  return (
    <group>
      <directionalLight
        ref={dirRef}
        castShadow
        position={[init.dirPos.x, init.dirPos.y, init.dirPos.z]}
        intensity={init.dirIntensity}
        color={init.dirColor}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
      <ambientLight ref={ambRef} intensity={init.ambIntensity} color={init.ambColor} />
      <hemisphereLight
        ref={hemiRef}
        args={[init.hemiSky.getStyle(), init.hemiGround.getStyle(), init.hemiIntensity]}
      />
      {INTERIOR_LIGHTS.map(([x, y, z], i) => (
        <pointLight
          key={i}
          ref={(el) => {
            pointRefs.current[i] = el;
          }}
          position={[x, y, z]}
          color="#ffd9a0"
          intensity={init.interiorIntensity}
          distance={18}
          decay={2}
        />
      ))}
    </group>
  );
});
