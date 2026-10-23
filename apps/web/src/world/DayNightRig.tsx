/**
 * Day/night lighting rig (rendered inside the Canvas): the user's 3-point
 * rig, driven by the existing useDayNightStore (store + toggle UI
 * untouched).
 *
 * 1. Sun: ONE shadow-casting directional light — warm 0xfff2df × 2.2 by
 *    day, cool 0xc9d8ee × 1.1 by night (2048 shadow map, ±34 ortho
 *    frustum, bias -0.0006, normalBias 0.02).
 * 2. Sky fill: hemisphere 0xbfd4e6 / 0x8a7a5f, 0.9 day / 0.5 night.
 * 3. Warm points: 0xffc98a, 8 day / 30 night, distance 12, decay 2 —
 *    8 fixtures over the rooms so the night scene stays clearly visible
 *    (never pitch black).
 *
 * scene.background + scene.fog lerp with the mode; all transitions ease
 * over ~1s (exponential lerp in useFrame). The first frame never flashes
 * the wrong sky: values snapshot the mount-time mode, and the honest
 * loading overlay is flipped off by FirstFrameSignal in OfficeScene only
 * after a real frame renders.
 *
 * The 2D pixel-art agents use THREE.SpriteMaterial (unlit) — they stay
 * visible automatically; no action needed here.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useDayNightStore } from "../stores/useDayNightStore";

const DAY_BG = "#87b5e0";
const NIGHT_BG = "#060a14";

/** Warm interior fixtures (no shadows, low cost): [x, y, z]. */
export const WARM_POINT_POSITIONS: Array<[number, number, number]> = [
  [0, 2.7, 7.2], // lobby
  [6.5, 2.7, 6.5], // lobby east
  [0, 2.7, 0], // workspace
  [-11.5, 2.7, 5.5], // project room
  [-11.5, 2.7, -7.0], // musola
  [-3.5, 2.7, -7.0], // recovery
  [3.8, 2.7, -7.0], // pantry
  [13.0, 2.7, 3.5], // meeting
];

export interface DayNightTargets {
  bg: string;
  sunColor: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  pointColor: string;
  pointIntensity: number;
}

/** Pure target computation — tested without WebGL. */
export function dayNightTargets(night: boolean): DayNightTargets {
  return {
    bg: night ? NIGHT_BG : DAY_BG,
    sunColor: night ? "#c9d8ee" : "#fff2df",
    sunIntensity: night ? 1.1 : 2.2,
    sunPosition: [18, 26, 12],
    hemiSky: "#bfd4e6",
    hemiGround: "#8a7a5f",
    hemiIntensity: night ? 0.5 : 0.9,
    pointColor: "#ffc98a",
    pointIntensity: night ? 30 : 8,
  };
}

interface Lerped {
  bg: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  pointIntensity: number;
}

function makeLerped(night: boolean): Lerped {
  const t = dayNightTargets(night);
  return {
    bg: new THREE.Color(t.bg),
    sunColor: new THREE.Color(t.sunColor),
    sunIntensity: t.sunIntensity,
    hemiSky: new THREE.Color(t.hemiSky),
    hemiGround: new THREE.Color(t.hemiGround),
    hemiIntensity: t.hemiIntensity,
    pointIntensity: t.pointIntensity,
  };
}

export const DayNightRig = memo(function DayNightRig() {
  const isNight = useDayNightStore((s) => s.isNight);
  const scene = useThree((s) => s.scene);

  // Snapshot the mode at mount so the first frame never flashes the wrong sky.
  const [initialNight] = useState(() => useDayNightStore.getState().isNight);

  const dirRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const pointRefs = useRef<Array<THREE.PointLight | null>>([]);
  const bgRef = useRef<THREE.Color | null>(null);

  // Current (lerped) values — start exactly at the mount-time targets.
  const cur = useRef<Lerped | null>(null);
  if (!cur.current) cur.current = makeLerped(initialNight);
  const target = useMemo(() => dayNightTargets(isNight), [isNight]);

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
  }, [scene, initialNight]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const k = 1 - Math.exp(-3 * dt); // ~1s ease
    const c = cur.current;
    if (!c) return;
    const t = target;

    c.bg.lerp(new THREE.Color(t.bg), k);
    c.sunColor.lerp(new THREE.Color(t.sunColor), k);
    c.sunIntensity += (t.sunIntensity - c.sunIntensity) * k;
    c.hemiSky.lerp(new THREE.Color(t.hemiSky), k);
    c.hemiGround.lerp(new THREE.Color(t.hemiGround), k);
    c.hemiIntensity += (t.hemiIntensity - c.hemiIntensity) * k;
    c.pointIntensity += (t.pointIntensity - c.pointIntensity) * k;

    if (bgRef.current) bgRef.current.copy(c.bg);
    const dir = dirRef.current;
    if (dir) {
      dir.color.copy(c.sunColor);
      dir.intensity = c.sunIntensity;
    }
    const hemi = hemiRef.current;
    if (hemi) {
      hemi.color.copy(c.hemiSky);
      hemi.groundColor.copy(c.hemiGround);
      hemi.intensity = c.hemiIntensity;
    }
    for (const p of pointRefs.current) {
      if (p) p.intensity = c.pointIntensity;
    }
  });

  const init = dayNightTargets(initialNight);

  return (
    <group>
      <directionalLight
        ref={dirRef}
        castShadow
        position={init.sunPosition}
        intensity={init.sunIntensity}
        color={init.sunColor}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-radius={4}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />
      <hemisphereLight
        ref={hemiRef}
        args={[init.hemiSky, init.hemiGround, init.hemiIntensity]}
      />
      {WARM_POINT_POSITIONS.map(([x, y, z], i) => (
        <pointLight
          key={i}
          ref={(el) => {
            pointRefs.current[i] = el;
          }}
          position={[x, y, z]}
          color={init.pointColor}
          intensity={init.pointIntensity}
          distance={12}
          decay={2}
        />
      ))}
    </group>
  );
});
