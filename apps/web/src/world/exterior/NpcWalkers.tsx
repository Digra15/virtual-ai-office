/**
 * Pedestrians on the far sidewalk: CUTES models with custom shirts,
 * hats and backpacks, strolling back and forth. They turn around
 * smoothly at the ends and are hidden beyond TRAFFIC_CULL_DISTANCE
 * like the road traffic. No-bunching rule: speeds are EQUAL within
 * a direction (1.2 eastbound, 1.1 westbound), so the starting
 * spacing between walkers never changes — nobody catches up and
 * queues behind a slower walker. The same-direction following gap
 * in npcWalk.ts stays only as a safety net for the turnaround arcs.
 * Eastbound walkers use the outer lane, westbound the inner lane.
 */
import { memo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CUTES_MODEL } from "../characters/CutesAvatar";
import { NpcAvatar, type NpcLook } from "./NpcAvatar";
import { TRAFFIC_CULL_DISTANCE } from "./traffic";
import {
  applyNpcSpacing,
  NPC_LANE_CHANGE_SPEED,
  npcDampYaw,
  npcLaneZ,
  npcStep,
  npcTargetYaw,
} from "./npcWalk";

interface NpcWalker {
  look: NpcLook;
  speed: number;
  startX: number;
  startDir: 1 | -1;
}

export const NPC_WALKERS: NpcWalker[] = [
  { look: { modelUrl: CUTES_MODEL.nika, shirtColor: "#e11d48", hat: null, glasses: null, backpack: false, hair: "long", hairColor: "#3f2a14", scale: 1 }, speed: 1.2, startX: -40, startDir: 1 },
  { look: { modelUrl: CUTES_MODEL.research, shirtColor: "#2563eb", hat: "baseball-cap-jarlan", glasses: "glasses-1", backpack: true, hair: null, hairColor: "#111827", scale: 1.05 }, speed: 1.1, startX: 10, startDir: -1 },
  { look: { modelUrl: CUTES_MODEL.coding, shirtColor: "#16a34a", hat: null, glasses: "glasses-2", backpack: false, hair: "spiky", hairColor: "#111827", scale: 0.95 }, speed: 1.2, startX: 30, startDir: 1 },
  { look: { modelUrl: CUTES_MODEL.writing, shirtColor: "#f59e0b", hat: null, glasses: "sunglasses", backpack: false, hair: "ponytail", hairColor: "#6b3f12", scale: 1 }, speed: 1.1, startX: -10, startDir: -1 },
  { look: { modelUrl: CUTES_MODEL.data, shirtColor: "#0891b2", hat: "baseball-cap-poly", glasses: null, backpack: true, hair: null, hairColor: "#111827", scale: 1 }, speed: 1.1, startX: 50, startDir: -1 },
  { look: { modelUrl: CUTES_MODEL.automation, shirtColor: "#db2777", hat: null, glasses: "pixel-glasses", backpack: false, hair: "afro", hairColor: "#1f2937", scale: 0.98 }, speed: 1.2, startX: -60, startDir: 1 },
  { look: { modelUrl: CUTES_MODEL.design, shirtColor: "#7c2d12", hat: null, glasses: "glasses-3", backpack: true, hair: "mohawk", hairColor: "#dc2626", scale: 1 }, speed: 1.1, startX: 58, startDir: -1 },
];

export const NpcWalkers = memo(function NpcWalkers() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const state = useRef(
    NPC_WALKERS.map((w) => ({ x: w.startX, dir: w.startDir, z: npcLaneZ(w.startDir), yaw: npcTargetYaw(w.startDir) })),
  );
  const camera = useThree((s) => s.camera);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    NPC_WALKERS.forEach((w, i) => {
      const st = state.current[i];
      const next = npcStep(st.x, st.dir, w.speed, dt);
      st.x = next.x;
      st.dir = next.dir;
    });
    // Same-direction following gap, applied before placing anyone.
    const spaced = applyNpcSpacing(state.current);
    NPC_WALKERS.forEach((_w, i) => {
      const g = refs.current[i];
      if (!g) return;
      const st = state.current[i];
      st.x = spaced[i];
      // Arc across to the other lane after turning around.
      const targetZ = npcLaneZ(st.dir);
      const dz = targetZ - st.z;
      const step = NPC_LANE_CHANGE_SPEED * dt;
      st.z += Math.abs(dz) <= step ? dz : Math.sign(dz) * step;
      st.yaw = npcDampYaw(st.yaw, npcTargetYaw(st.dir), dt);
      g.position.set(st.x, -0.2, st.z);
      g.rotation.set(0, st.yaw, 0);
      g.visible = camera.position.distanceTo(g.position) < TRAFFIC_CULL_DISTANCE;
    });
  });
  return (
    <group>
      {NPC_WALKERS.map((w, i) => (
        <group
          key={`${w.look.modelUrl}-${i}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <NpcAvatar look={w.look} />
        </group>
      ))}
    </group>
  );
});
