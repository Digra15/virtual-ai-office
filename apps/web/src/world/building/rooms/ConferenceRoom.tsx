/**
 * Conference Room (ground floor, x -20..-9, z -14..-5): large meeting table,
 * six chairs, whiteboard + wall display on the north wall, glass partitions.
 * Coordinates reuse the original MeetingRoom layout (same rect).
 */
import { memo } from "react";
import { Text } from "@react-three/drei";
import {
  MEETING_CHAIR_SLOTS,
  MEETING_TABLE_CENTER,
} from "../../rooms/MeetingRoom";
import { InstancedChairs } from "../../furniture/Chair";
import { MeetingTable } from "../../furniture/MeetingTable";
import { Plant } from "../../furniture/Plant";
import { Rug } from "../../furniture/Rug";
import { Wall } from "../../furniture/Wall";
import { Whiteboard } from "../../furniture/Whiteboard";
import { geoBox, geoPlane } from "../../geometries";
import { Signage } from "../../furniture/Signage";
import { matPanelDark } from "./_fallback";

/** Wall display next to the whiteboard. */
const WallDisplay = memo(function WallDisplay() {
  return (
    <group position={[-18, 0, -13.85]}>
      <mesh geometry={geoBox} material={matPanelDark} scale={[3.0, 1.7, 0.1]} position={[0, 1.9, 0]} />
      <mesh geometry={geoPlane} position={[0, 1.9, 0.06]} scale={[2.8, 1.5, 1]}>
        <meshBasicMaterial color="#12325b" />
      </mesh>
      <Text position={[0, 2.15, 0.08]} fontSize={0.26} color="#bfdbfe" anchorX="center" anchorY="middle">
        Q3 PLANNING
      </Text>
      <Text position={[0, 1.7, 0.08]} fontSize={0.17} color="#93c5fd" anchorX="center" anchorY="middle">
        all-hands • friday 10:00
      </Text>
    </group>
  );
});

export const ConferenceRoom = memo(function ConferenceRoom() {
  const { x, z } = MEETING_TABLE_CENTER;
  return (
    <group>
      {/* glass partitions: east toward the server corridor, south toward open floor */}
      <Wall length={9} position={[-9, 0, -9.5]} rotationY={Math.PI / 2} windows={3} />
      <Wall length={11} position={[-14.5, 0, -5]} windows={4} />
      <Rug position={[x, 0, z]} radius={3.2} />
      <MeetingTable position={[x, 0, z]} />
      <InstancedChairs slots={MEETING_CHAIR_SLOTS} />
      <Whiteboard position={[-14, 0, -13.4]} rotationY={0} />
      <WallDisplay />
      <Signage text="CONFERENCE" position={[-11.5, 2.3, -5.15]} rotationY={Math.PI} />
      <Plant position={[-19, 0, -6]} scale={1.3} />
    </group>
  );
});
