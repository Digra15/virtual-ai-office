/**
 * Ruang Server (x 12..16, z -12..-4.5): 3 server racks with cyan LED
 * strips, and the LIVE backend-health display subscribed to the real
 * useConnectionStore (status label + color) — the wiring from the old
 * room, remounted on the north wall.
 */
import { memo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { useConnectionStore } from "../../../stores/useConnectionStore";
import { geoBox } from "../../geometries";

const matRack = new THREE.MeshStandardMaterial({ color: "#141a24", roughness: 0.5, metalness: 0.4 });
const matRackFrame = new THREE.MeshStandardMaterial({ color: "#0b0f16", roughness: 0.6 });
const matPanelDark = new THREE.MeshStandardMaterial({ color: "#0b1220", roughness: 0.5 });

/** Rack positions: 3 racks at x=13.8, fronts face -X into the room. */
export const SERVER_RACKS: Array<[number, number]> = [
  [13.8, -10],
  [13.8, -8.5],
  [13.8, -7],
];

/** One rack: dark cabinet + 8 cyan LED strips on the front face. */
const Rack = memo(function Rack({ position }: { position: [number, number] }) {
  const [x, z] = position;
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={geoBox} material={matRack} scale={[0.9, 2.0, 0.8]} position={[0, 1.0, 0]} castShadow />
      <mesh geometry={geoBox} material={matRackFrame} scale={[0.94, 0.08, 0.84]} position={[0, 2.02, 0]} />
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} geometry={geoBox} scale={[0.03, 0.05, 0.66]} position={[-0.46, 0.35 + i * 0.2, 0]}>
          <meshBasicMaterial color="#22d3ee" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
});

/**
 * Live backend-health display — re-renders only when connection status
 * changes. Mounted on the north wall (z=-12), facing +Z into the room.
 */
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
    <group position={[14.2, 0, -11.9]}>
      <mesh geometry={geoBox} material={matPanelDark} scale={[3.6, 1.7, 0.1]} position={[0, 2.1, 0]} castShadow />
      <Text position={[0, 2.4, 0.06]} fontSize={0.32} color={color} anchorX="center" anchorY="middle">
        {label}
      </Text>
      <Text position={[0, 1.9, 0.06]} fontSize={0.18} color="#64748b" anchorX="center" anchorY="middle">
        uptime 99.98% • 3 racks online
      </Text>
      {/* status-colored LED strip */}
      <mesh geometry={geoBox} scale={[3.6, 0.08, 0.12]} position={[0, 1.2, 0]}>
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
});

export const ServerRoom = memo(function ServerRoom() {
  return (
    <group>
      {SERVER_RACKS.map(([x, z]) => (
        <Rack key={`${x}:${z}`} position={[x, z]} />
      ))}
      <ServerHealthDisplay />
    </group>
  );
});
