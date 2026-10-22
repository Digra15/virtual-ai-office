/**
 * Resepsionis (ground floor, x -20..-10, z 6..14): the main entrance
 * ("Pintu Masuk") — welcome counter with DIFIA branding, waiting sofas,
 * visitor info screen, and the glass entrance doors on the south wall
 * (the shell owns the wall gap at x -16..-12 and hangs the doors).
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

/** Visitor info screen on the west wall (emissive plane + text). */
const InfoScreen = memo(function InfoScreen() {
  return (
    <group position={[-19.82, 0, 10]} rotation={[0, Math.PI / 2, 0]}>
      <mesh geometry={geoBox} material={matPanelDark} scale={[3.4, 2.0, 0.1]} position={[0, 1.9, 0]} />
      <mesh geometry={geoPlane} position={[0, 1.9, 0.06]} scale={[3.1, 1.7, 1]}>
        <meshBasicMaterial color="#0e7490" />
      </mesh>
      <Text position={[0, 2.35, 0.08]} fontSize={0.3} color="#ecfeff" anchorX="center" anchorY="middle">
        SELAMAT DATANG
      </Text>
      <Text position={[0, 1.95, 0.08]} fontSize={0.22} color="#a5f3fc" anchorX="center" anchorY="middle">
        VIRTUAL AI OFFICE
      </Text>
      <Text position={[0, 1.55, 0.08]} fontSize={0.15} color="#cffafe" anchorX="center" anchorY="middle">
        silakan check-in di meja resepsionis
      </Text>
    </group>
  );
});

export const Reception = memo(function Reception() {
  return (
    <group>
      {/* north partition (z=6) is owned by the project room */}
      {/* east partition: door gap z 9..11 into the workspace bullpen */}
      <WallSegments axis="z" fixed={-10} from={6} to={14} gaps={[[9, 11]]} />
      <Door position={[-10, 0, 10]} rotationY={Math.PI / 2} width={2} />
      <Signage text="PINTU MASUK" position={[-14, 2.9, 13.82]} rotationY={Math.PI} scale={0.6} />

      <ReceptionCounter position={[-14, 0, 11.5]} />
      <Signage text="DIFIA" subtext="RESEPSIONIS" position={[-14, 2.3, 11.1]} scale={0.9} />

      {/* waiting area */}
      <Rug position={[-17, 0, 8.2]} radius={2} />
      <Sofa position={[-17, 0, 7.3]} rotationY={Math.PI} />
      <CoffeeTable position={[-17, 0, 8.8]} />
      <InfoScreen />
      <Plant position={[-19.2, 0, 13.2]} />
      <Plant position={[-10.8, 0, 13.2]} />
      <Plant position={[-19.2, 0, 6.8]} scale={0.85} />
      <CeilingLamp position={[-16, 10]} />
      <CeilingLamp position={[-12, 8]} />
    </group>
  );
});
