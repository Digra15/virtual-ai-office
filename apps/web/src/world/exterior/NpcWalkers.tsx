/**
 * Pedestrians on the far sidewalk (z=NPC_LANE_Z): CUTES models with
 * custom shirts, hats and backpacks, strolling back and forth. They
 * turn around smoothly at the ends and are hidden beyond
 * TRAFFIC_CULL_DISTANCE like the road traffic.
 */
import { memo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CUTES_MODEL } from "../characters/CutesAvatar";
import { NpcAvatar, type NpcLook } from "./NpcAvatar";
import { TRAFFIC_CULL_DISTANCE } from "./traffic";
import {
  NPC_LANE_Z,
  npcDampYaw,
  npcStep,
  npcTargetYaw,
} from "./npcWalk";

interface NpcWalker {
  look: NpcLook;
  speed: number;
  startX: number;
  startDir: 1 | -1;
}

const NPC_WALKERS: NpcWalker[] = [
  { look: { modelUrl: CUTES_MODEL.nika, shirtColor: "#e11d48", hat: "cap", hatColor: "#1e293b", backpackColor: null, scale: 1 }, speed: 1.2, startX: -40, startDir: 1 },
  { look: { modelUrl: CUTES_MODEL.research, shirtColor: "#2563eb", hat: "sunhat", hatColor: "#f59e0b", backpackColor: "#334155", scale: 1.05 }, speed: 1.0, startX: 10, startDir: -1 },
  { look: { modelUrl: CUTES_MODEL.coding, shirtColor: "#16a34a", hat: "beanie", hatColor: "#7c3aed", backpackColor: null, scale: 0.95 }, speed: 1.4, startX: 30, startDir: 1 },
  { look: { modelUrl: CUTES_MODEL.writing, shirtColor: "#f59e0b", hat: "cap", hatColor: "#dc2626", backpackColor: null, scale: 1 }, speed: 1.1, startX: -10, startDir: -1 },
  { look: { modelUrl: CUTES_MODEL.data, shirtColor: "#0891b2", hat: "sunhat", hatColor: "#fef3c7", backpackColor: "#b45309", scale: 1 }, speed: 1.3, startX: 50, startDir: -1 },
  { look: { modelUrl: CUTES_MODEL.automation, shirtColor: "#db2777", hat: "beanie", hatColor: "#111827", backpackColor: null, scale: 0.98 }, speed: 1.15, startX: -60, startDir: 1 },
  { look: { modelUrl: CUTES_MODEL.design, shirtColor: "#7c2d12", hat: "cap", hatColor: "#facc15", backpackColor: "#1f2937", scale: 1 }, speed: 1.05, startX: 58, startDir: -1 },
];

export const NpcWalkers = memo(function NpcWalkers() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const state = useRef(
    NPC_WALKERS.map((w) => ({ x: w.startX, dir: w.startDir, yaw: npcTargetYaw(w.startDir) })),
  );
  const camera = useThree((s) => s.camera);
  useFrame((_, delta) => {
    NPC_WALKERS.forEach((w, i) => {
      const g = refs.current[i];
      if (!g) return;
      const st = state.current[i];
      const next = npcStep(st.x, st.dir, w.speed, Math.min(delta, 0.1));
      st.x = next.x;
      st.dir = next.dir;
      st.yaw = npcDampYaw(st.yaw, npcTargetYaw(st.dir), Math.min(delta, 0.1));
      g.position.set(st.x, -0.2, NPC_LANE_Z);
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
