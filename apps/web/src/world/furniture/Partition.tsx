import { memo } from "react";
import { geoBox } from "../geometries";
import { matDeskLeg, matPartition } from "../materials";

interface PartitionProps {
  position?: [number, number, number];
  rotationY?: number;
  width?: number;
}

/** Desk divider panel with small feet. */
export const Partition = memo(function Partition({
  position = [0, 0, 0],
  rotationY = 0,
  width = 1.8,
}: PartitionProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matPartition} scale={[width, 1.05, 0.05]} position={[0, 1.32, 0]} castShadow />
      <mesh geometry={geoBox} material={matDeskLeg} scale={[0.08, 0.1, 0.3]} position={[-width / 2 + 0.15, 0.84, 0]} />
      <mesh geometry={geoBox} material={matDeskLeg} scale={[0.08, 0.1, 0.3]} position={[width / 2 - 0.15, 0.84, 0]} />
    </group>
  );
});
