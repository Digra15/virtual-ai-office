/**
 * Ruang Server (ground floor, x -11..-2, z -14..-5): four racks with LEDs,
 * cooling unit, cable tray, live backend-health display, TERBATAS signage.
 * Full-height walls + door (privacy/security).
 */
import { memo } from "react";
import { Text } from "@react-three/drei";
import { useConnectionStore } from "../../../stores/useConnectionStore";
import { ServerRack } from "../../furniture/ServerRack";
import { Wall } from "../../furniture/Wall";
import { geoBox, geoCylinder } from "../../geometries";
import { Door } from "../../furniture/Door";
import { Signage } from "../../furniture/Signage";
import { matPanelDark } from "./_fallback";
import { WallSegments } from "./_helpers";

/** Live backend-health display — re-renders only when connection status changes. */
const ServerHealthDisplay = memo(function ServerHealthDisplay() {
  const status = useConnectionStore((s) => s.status);
  const label =
    status === "live"
      ? "BACKEND: LIVE"
      : status === "demo-local"
        ? "BACKEND: LOCAL DEMO"
        : status === "error"
          ? "BACKEND: ERROR"
          : "BACKEND: CONNECTING";
  const color =
    status === "live"
      ? "#22c55e"
      : status === "demo-local"
        ? "#f59e0b"
        : status === "error"
          ? "#ef4444"
          : "#38bdf8";
  return (
    <group position={[-2.18, 0, -9.5]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh geometry={geoBox} material={matPanelDark} scale={[3.6, 1.7, 0.1]} position={[0, 2.1, 0]} />
      <Text position={[0, 2.4, 0.06]} fontSize={0.32} color={color} anchorX="center" anchorY="middle">
        {label}
      </Text>
      <Text position={[0, 1.9, 0.06]} fontSize={0.18} color="#64748b" anchorX="center" anchorY="middle">
        uptime 99.98% • 4 racks online
      </Text>
      {/* status-colored LED strip */}
      <mesh geometry={geoBox} scale={[3.6, 0.08, 0.12]} position={[0, 1.2, 0]}>
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
});

const RACK_ZS = [-12.4, -10.9, -9.4, -7.9];

export const ServerRoom = memo(function ServerRoom() {
  return (
    <group>
      {/* full-height privacy walls; south wall has the door gap (x -7.5..-5.5) */}
      <Wall length={9} position={[-2, 0, -9.5]} rotationY={Math.PI / 2} />
      <WallSegments axis="x" fixed={-5} from={-11} to={-2} gaps={[[-7.5, -5.5]]} height={3.2} />
      <Door position={[-6.5, 0, -5]} width={2} />
      {/* four racks along the west wall */}
      {RACK_ZS.map((z) => (
        <ServerRack key={z} position={[-10.3, 0, z]} rotationY={Math.PI / 2} />
      ))}
      {/* cooling unit */}
      <group position={[-2.8, 0, -13]}>
        <mesh geometry={geoBox} material={matPanelDark} scale={[1.1, 1.8, 0.6]} position={[0, 0.9, 0]} castShadow />
        <mesh geometry={geoCylinder} scale={[0.7, 0.06, 0.7]} position={[0, 1.1, 0.32]}>
          <meshBasicMaterial color="#164e63" />
        </mesh>
        <mesh geometry={geoBox} scale={[1.1, 0.08, 0.62]} position={[0, 0.35, 0]}>
          <meshBasicMaterial color="#22d3ee" />
        </mesh>
      </group>
      {/* cable tray near the ceiling, above the racks */}
      <mesh geometry={geoBox} material={matPanelDark} scale={[0.4, 0.08, 7.4]} position={[-10.3, 2.9, -10.15]} />
      <ServerHealthDisplay />
      <Signage text="TERBATAS" position={[-6.5, 2.3, -4.82]} rotationY={Math.PI} scale={0.8} />
    </group>
  );
});
