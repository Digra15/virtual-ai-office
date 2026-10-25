/**
 * Live traffic: the user's GLB vehicles driving the straight road in
 * front of the office (see Road.tsx for the road, traffic.ts for the
 * straight-line math).
 *
 * Each vehicle drives its lane at its own speed; the north lane runs
 * east, the south lane west (Indonesian left-hand traffic). Distance
 * wraps modulo the road length, so a vehicle leaving one end
 * re-enters at the other. Per-camera rendering: three.js frustum
 * culling hides off-screen vehicles automatically, and groups
 * farther than TRAFFIC_CULL_DISTANCE from the camera are hidden
 * outright.
 */
import { memo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PolyModel } from "../PolyModel";
import {
  ROAD_LENGTH,
  ROAD_TOP_Y,
  TRAFFIC_CULL_DISTANCE,
  TRAFFIC_VEHICLES,
  VEHICLE_FRONT,
  straightPoint,
} from "./traffic";

export const Traffic = memo(function Traffic() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const camera = useThree((s) => s.camera);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    TRAFFIC_VEHICLES.forEach((v, i) => {
      const g = refs.current[i];
      if (!g) return;
      const s = (v.offset + v.speed * t) % ROAD_LENGTH;
      const p = straightPoint(v.lane, s);
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
          <PolyModel file={v.file} folder="vehicles" position={[0, 0, 0]} scale={v.scale} />
        </group>
      ))}
    </group>
  );
});
