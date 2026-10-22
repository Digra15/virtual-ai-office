/**
 * Reception (ground floor, x 8..20, z 8..14): welcome counter, waiting
 * sofas, visitor info screen, glass entrance door on the south wall.
 */
import { memo } from "react";
import { Text } from "@react-three/drei";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { CoffeeTable } from "../../furniture/CoffeeTable";
import { Plant } from "../../furniture/Plant";
import { Rug } from "../../furniture/Rug";
import { Sofa } from "../../furniture/Sofa";
import { geoBox, geoPlane } from "../../geometries";
import { Door } from "../../furniture/Door";
import { ReceptionCounter } from "../../furniture/ReceptionCounter";
import { Signage } from "../../furniture/Signage";
import { matPanelDark } from "./_fallback";
import { WallSegments } from "./_helpers";

/** Visitor info screen on the east wall (emissive plane + text). */
const InfoScreen = memo(function InfoScreen() {
  return (
    <group position={[19.82, 0, 11]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh geometry={geoBox} material={matPanelDark} scale={[3.4, 2.0, 0.1]} position={[0, 1.9, 0]} />
      <mesh geometry={geoPlane} position={[0, 1.9, 0.06]} scale={[3.1, 1.7, 1]}>
        <meshBasicMaterial color="#0e7490" />
      </mesh>
      <Text position={[0, 2.35, 0.08]} fontSize={0.3} color="#ecfeff" anchorX="center" anchorY="middle">
        WELCOME
      </Text>
      <Text position={[0, 1.95, 0.08]} fontSize={0.22} color="#a5f3fc" anchorX="center" anchorY="middle">
        VIRTUAL AI OFFICE
      </Text>
      <Text position={[0, 1.55, 0.08]} fontSize={0.15} color="#cffafe" anchorX="center" anchorY="middle">
        visitors please check in
      </Text>
    </group>
  );
});

export const Reception = memo(function Reception() {
  return (
    <group>
      {/* low partitions: north toward the atrium void, west toward open floor */}
      <WallSegments axis="x" fixed={8} from={8} to={20} />
      <WallSegments axis="z" fixed={8} from={8} to={14} />
      {/* glass entrance door in the south exterior wall gap (x 12..16) */}
      <Door position={[14, 0, 13.9]} width={3} />
      <ReceptionCounter position={[14, 0, 12.2]} />
      {/* waiting area */}
      <Rug position={[17.5, 0, 10]} radius={2} />
      <Sofa position={[17.5, 0, 9.1]} rotationY={Math.PI} />
      <CoffeeTable position={[17.5, 0, 10.6]} />
      <Signage text="RECEPTION" position={[14, 2.3, 8.15]} />
      <InfoScreen />
      <Plant position={[8.8, 0, 13.2]} />
      <Plant position={[19.2, 0, 8.8]} />
      <Plant position={[9, 0, 8.8]} scale={0.85} />
      <CeilingLamp position={[12, 11]} />
      <CeilingLamp position={[17, 11]} />
    </group>
  );
});
