import { memo } from "react";
import * as THREE from "three";
import { geoBox, geoCylinder } from "../geometries";

interface FurnitureProps {
  position?: [number, number, number];
  rotationY?: number;
}

const matFrame = new THREE.MeshStandardMaterial({ color: "#141a24", roughness: 0.45, metalness: 0.6 });
const matDoorGlass = new THREE.MeshStandardMaterial({
  color: "#93c5fd",
  transparent: true,
  opacity: 0.45,
  roughness: 0.1,
  metalness: 0.1,
  side: THREE.DoubleSide,
});

/**
 * Glass door panel with frame. When `open`, the panel swings 70 degrees on
 * its hinge. Used at the reception entrance and stair tower doors.
 */
export const Door = memo(function Door({
  position = [0, 0, 0],
  rotationY = 0,
  open = false,
  width = 2,
  height = 2.6,
}: FurnitureProps & { open?: boolean; width?: number; height?: number }) {
  const hingeX = -width / 2 + 0.06;
  const panelW = width - 0.12;
  const panelAngle = open ? (-70 * Math.PI) / 180 : 0;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* frame posts + header */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={geoBox}
          material={matFrame}
          scale={[0.12, height, 0.3]}
          position={[(s * width) / 2, height / 2, 0]}
          castShadow
        />
      ))}
      <mesh
        geometry={geoBox}
        material={matFrame}
        scale={[width + 0.12, 0.15, 0.3]}
        position={[0, height + 0.075, 0]}
        castShadow
      />
      {/* hinged glass panel */}
      <group position={[hingeX, 0, 0]} rotation={[0, panelAngle, 0]}>
        <mesh
          geometry={geoBox}
          material={matDoorGlass}
          scale={[panelW, height - 0.15, 0.06]}
          position={[panelW / 2, height / 2 - 0.02, 0]}
        />
        {/* push bar */}
        <mesh
          geometry={geoCylinder}
          material={matFrame}
          scale={[0.05, 0.9, 0.05]}
          position={[panelW / 2, 1.05, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      </group>
    </group>
  );
});
