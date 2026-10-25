/**
 * Live traffic: GLB vehicles circulating the ring road (see Road.tsx
 * for the road itself, traffic.ts for the loop math).
 *
 * Each vehicle rides its lane loop at its own speed; the outer lane
 * runs direction +1, the inner lane direction -1 (Indonesian
 * left-hand traffic). Per-camera rendering: three.js frustum culling
 * hides off-screen vehicles automatically, and groups farther than
 * TRAFFIC_CULL_DISTANCE from the camera are hidden outright.
 */
import { memo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PolyModel } from "../PolyModel";
import {
  ROAD_TOP_Y,
  TRAFFIC_CULL_DISTANCE,
  TRAFFIC_VEHICLES,
  VEHICLE_FRONT,
  laneLoop,
  loopLength,
  loopPoint,
} from "./traffic";

export const Traffic = memo(function Traffic() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const camera = useThree((s) => s.camera);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    TRAFFIC_VEHICLES.forEach((v, i) => {
      const g = refs.current[i];
      if (!g) return;
      const loop = laneLoop(v.lane);
      const s = (v.offset + v.speed * t) % loopLength(loop);
      const p = loopPoint(loop, s, v.lane === "outer" ? 1 : -1);
      g.position.set(p.x, ROAD_TOP_Y, p.z);
      const front = VEHICLE_FRONT[v.file] ?? 1;
      g.rotation.set(0, p.heading + (front === -1 ? Math.PI : 0), 0);
      g.visible = camera.position.distanceTo(g.position) < TRAFFIC_CULL_DISTANCE;
    });
  });
  return (
    <group>
      {TRAFFIC_VEHICLES.map((v, i) => (
        <group
          key={`${v.file}-${v.lane}-${v.offset}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <PolyModel file={v.file} folder="vehicles" position={[0, 0, 0]} scale={1} />
        </group>
      ))}
    </group>
  );
});
