import { memo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { geoBox } from "../geometries";

interface SignageProps {
  position?: [number, number, number];
  rotationY?: number;
  text: string;
  subtext?: string;
  /** Scales the whole sign (panel + text). */
  scale?: number;
}

const matPanel = new THREE.MeshStandardMaterial({ color: "#0b1220", roughness: 0.5, metalness: 0.3 });
const matAccent = new THREE.MeshStandardMaterial({
  color: "#0ea5e9",
  emissive: new THREE.Color("#0ea5e9"),
  emissiveIntensity: 1.4,
  roughness: 0.4,
});

/**
 * Wall sign: dark panel + glowing accent bar + drei Text. For room labels,
 * facade branding, restroom signs, etc.
 */
export const Signage = memo(function Signage({
  position = [0, 0, 0],
  rotationY = 0,
  text,
  subtext,
  scale = 1,
}: SignageProps) {
  const panelW = Math.max(1.6, text.length * 0.42 + 0.8);
  const panelH = subtext ? 1.5 : 1.1;

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
      <mesh geometry={geoBox} material={matPanel} scale={[panelW, panelH, 0.12]} castShadow />
      <mesh geometry={geoBox} material={matAccent} scale={[panelW, 0.08, 0.13]} position={[0, -panelH / 2 + 0.08, 0]} />
      <Text
        position={[0, subtext ? 0.18 : 0, 0.07]}
        fontSize={0.52}
        color="#f1f5f9"
        anchorX="center"
        anchorY="middle"
      >
        {text}
      </Text>
      {subtext && (
        <Text position={[0, -0.38, 0.07]} fontSize={0.26} color="#7dd3fc" anchorX="center" anchorY="middle">
          {subtext}
        </Text>
      )}
    </group>
  );
});
