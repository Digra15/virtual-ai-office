import { memo, useMemo } from "react";
import * as THREE from "three";
import { geoBox, geoPlane } from "../geometries";
import { matMonitorFrame, matMonitorStand } from "../materials";

interface MonitorProps {
  position?: [number, number, number];
  rotationY?: number;
  /** Status color shown on the glowing screen. */
  accent?: string;
}

/**
 * Desk monitor. The screen is emissive and tinted with the agent's status
 * color (via the `accent` prop) — never a shared material, it's built per
 * instance in useMemo.
 */
export const Monitor = memo(function Monitor({
  position = [0, 0, 0],
  rotationY = 0,
  accent = "#38bdf8",
}: MonitorProps) {
  const screenMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#020617",
        emissive: new THREE.Color(accent),
        emissiveIntensity: 0.85,
        roughness: 0.35,
      }),
    [accent],
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* stand */}
      <mesh geometry={geoBox} material={matMonitorStand} scale={[0.34, 0.04, 0.24]} position={[0, 0.81, 0]} />
      <mesh geometry={geoBox} material={matMonitorStand} scale={[0.07, 0.42, 0.07]} position={[0, 1.0, -0.04]} />
      {/* screen body */}
      <mesh geometry={geoBox} material={matMonitorFrame} scale={[1.15, 0.68, 0.06]} position={[0, 1.32, 0]} castShadow />
      {/* glowing face toward +z (the seated avatar) */}
      <mesh geometry={geoPlane} material={screenMat} scale={[1.05, 0.58, 1]} position={[0, 1.32, 0.031]} />
    </group>
  );
});
