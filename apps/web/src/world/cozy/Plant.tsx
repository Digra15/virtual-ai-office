import { memo } from "react";

export interface CozyPlantProps {
  position?: [number, number, number];
  scale?: number;
}

const POT = "#c1663e";
const SOIL = "#4a3220";
const LEAVES: Array<{ p: [number, number, number]; r: number; c: string }> = [
  { p: [0, 0.52, 0], r: 0.2, c: "#4e8a3f" },
  { p: [0.15, 0.42, 0.07], r: 0.15, c: "#5da24a" },
  { p: [-0.14, 0.44, -0.05], r: 0.16, c: "#3f7a34" },
  { p: [0.04, 0.4, -0.14], r: 0.13, c: "#5da24a" },
  { p: [-0.05, 0.41, 0.15], r: 0.14, c: "#4e8a3f" },
];

/**
 * Harvest-Moon style potted plant: terracotta pot + rim + soil +
 * five dodecahedron leaf clusters.
 */
export const CozyPlant = memo(function CozyPlant({
  position = [0, 0, 0],
  scale = 1,
}: CozyPlantProps) {
  return (
    <group position={position} scale={scale}>
      {/* terracotta pot */}
      <mesh position={[0, 0.13, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.115, 0.26, 14]} />
        <meshStandardMaterial color={POT} roughness={0.85} />
      </mesh>
      {/* rim */}
      <mesh position={[0, 0.26, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.155, 0.032, 10, 20]} />
        <meshStandardMaterial color={POT} roughness={0.85} />
      </mesh>
      {/* soil */}
      <mesh position={[0, 0.265, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.03, 14]} />
        <meshStandardMaterial color={SOIL} roughness={1} />
      </mesh>
      {/* five leaf clusters */}
      {LEAVES.map((l, i) => (
        <mesh key={i} position={l.p} rotation={[i * 0.7, i * 1.3, 0]} castShadow>
          <dodecahedronGeometry args={[l.r, 0]} />
          <meshStandardMaterial color={l.c} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
});
