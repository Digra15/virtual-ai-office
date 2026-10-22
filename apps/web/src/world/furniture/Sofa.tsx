import { memo } from "react";
import { geoBox } from "../geometries";
import { matSofa, matSofaCushion } from "../materials";

interface SofaProps {
  position?: [number, number, number];
  rotationY?: number;
}

/** Two-seater sofa: base, back, arms, two cushions. Faces local +z. */
export const Sofa = memo(function Sofa({
  position = [0, 0, 0],
  rotationY = 0,
}: SofaProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matSofa} scale={[2.2, 0.35, 0.9]} position={[0, 0.28, 0]} castShadow receiveShadow />
      <mesh geometry={geoBox} material={matSofa} scale={[2.2, 0.65, 0.25]} position={[0, 0.75, -0.33]} castShadow />
      <mesh geometry={geoBox} material={matSofa} scale={[0.25, 0.55, 0.9]} position={[-0.98, 0.55, 0]} castShadow />
      <mesh geometry={geoBox} material={matSofa} scale={[0.25, 0.55, 0.9]} position={[0.98, 0.55, 0]} castShadow />
      <mesh geometry={geoBox} material={matSofaCushion} scale={[0.92, 0.18, 0.72]} position={[-0.5, 0.54, 0.04]} castShadow />
      <mesh geometry={geoBox} material={matSofaCushion} scale={[0.92, 0.18, 0.72]} position={[0.5, 0.54, 0.04]} castShadow />
    </group>
  );
});
