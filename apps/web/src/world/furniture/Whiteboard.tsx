import { memo } from "react";
import { geoBox, geoPlane } from "../geometries";
import { matWhiteboard, matWhiteboardFrame } from "../materials";

interface WhiteboardProps {
  position?: [number, number, number];
  rotationY?: number;
}

/** Rolling whiteboard: frame, white face, legs, marker tray. */
export const Whiteboard = memo(function Whiteboard({
  position = [0, 0, 0],
  rotationY = 0,
}: WhiteboardProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matWhiteboardFrame} scale={[2.2, 1.3, 0.06]} position={[0, 1.6, 0]} castShadow />
      <mesh geometry={geoPlane} material={matWhiteboard} scale={[2.05, 1.15, 1]} position={[0, 1.6, 0.035]} />
      <mesh geometry={geoBox} material={matWhiteboardFrame} scale={[2.0, 0.05, 0.12]} position={[0, 0.98, 0.06]} />
      <mesh geometry={geoBox} material={matWhiteboardFrame} scale={[0.08, 1.0, 0.08]} position={[-0.9, 0.5, 0]} />
      <mesh geometry={geoBox} material={matWhiteboardFrame} scale={[0.08, 1.0, 0.08]} position={[0.9, 0.5, 0]} />
    </group>
  );
});
