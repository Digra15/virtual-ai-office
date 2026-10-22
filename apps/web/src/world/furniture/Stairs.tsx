import { memo } from "react";
import * as THREE from "three";
import { geoBox } from "../geometries";

interface StairsProps {
  position?: [number, number, number];
  rotationY?: number;
  width?: number;
  steps?: number;
  height?: number;
  length?: number;
}

const matStep = new THREE.MeshStandardMaterial({ color: "#3b4761", roughness: 0.85 });
const matRail = new THREE.MeshStandardMaterial({ color: "#1a2230", roughness: 0.45, metalness: 0.6 });

/**
 * Generic straight staircase running along local +Z, rising from y=0 to
 * y=height over `length`. Solid stacked treads + sloped handrails on both
 * sides. Used for the stair tower (see building/floorPlan STAIR_TOWER).
 */
export const Stairs = memo(function Stairs({
  position = [0, 0, 0],
  rotationY = 0,
  width = 2,
  steps = 12,
  height = 3.5,
  length = 6,
}: StairsProps) {
  const rise = height / steps;
  const run = length / steps;
  const railAngle = Math.atan2(height, length);
  const railLen = Math.hypot(length, height);
  const treadIdx = Array.from({ length: steps }, (_, i) => i);
  const postZ = [0.4, length * 0.35, length * 0.65, length - 0.4];

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* solid stacked treads */}
      {treadIdx.map((i) => {
        const topY = (i + 1) * rise;
        return (
          <mesh
            key={i}
            geometry={geoBox}
            material={matStep}
            scale={[width, topY, run]}
            position={[0, topY / 2, i * run + run / 2]}
            castShadow
            receiveShadow
          />
        );
      })}
      {/* handrails both sides */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh
            geometry={geoBox}
            material={matRail}
            scale={[0.07, 0.07, railLen]}
            position={[(s * width) / 2, height / 2 + 0.9, length / 2]}
            rotation={[-railAngle, 0, 0]}
            castShadow
          />
          {postZ.map((z) => (
            <mesh
              key={z}
              geometry={geoBox}
              material={matRail}
              scale={[0.06, 0.95, 0.06]}
              position={[(s * width) / 2, (z / length) * height + 0.475, z]}
              castShadow
            />
          ))}
        </group>
      ))}
    </group>
  );
});
