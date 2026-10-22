/**
 * Ruang Meeting (ground floor, x -20..-11, z -14..-5): large meeting table,
 * six chairs (MEETING_CHAIR_SLOTS — also the agent seats used by A2A
 * meetings), whiteboard + wall display on the north wall, glass partition
 * toward the server room. Coordinates reuse the original MeetingRoom
 * layout (same table center).
 */
import { memo } from "react";
import { Text } from "@react-three/drei";
import {
  MEETING_CHAIR_SLOTS,
  MEETING_TABLE_CENTER,
} from "../../rooms/MeetingRoom";
import { Door } from "../../furniture/Door";
import { InstancedChairs } from "../../furniture/Chair";
import { MeetingTable } from "../../furniture/MeetingTable";
import { Plant } from "../../furniture/Plant";
import { Rug } from "../../furniture/Rug";
import { Wall } from "../../furniture/Wall";
import { Whiteboard } from "../../furniture/Whiteboard";
import { geoBox, geoPlane } from "../../geometries";
import { Signage } from "../../furniture/Signage";
import { matPanelDark } from "./_fallback";
import { WallSegments } from "./_helpers";

/** Wall display next to the whiteboard. */
const WallDisplay = memo(function WallDisplay() {
  return (
    <group position={[-18, 0, -13.85]}>
      <mesh geometry={geoBox} material={matPanelDark} scale={[3.0, 1.7, 0.1]} position={[0, 1.9, 0]} />
      <mesh geometry={geoPlane} position={[0, 1.9, 0.06]} scale={[2.8, 1.5, 1]}>
        <meshBasicMaterial color="#12325b" />
      </mesh>
      <Text position={[0, 2.15, 0.08]} fontSize={0.26} color="#bfdbfe" anchorX="center" anchorY="middle">
        RENCANA Q3
      </Text>
      <Text position={[0, 1.7, 0.08]} fontSize={0.17} color="#93c5fd" anchorX="center" anchorY="middle">
        all-hands • jumat 10:00
      </Text>
    </group>
  );
});

export const ConferenceRoom = memo(function ConferenceRoom() {
  const { x, z } = MEETING_TABLE_CENTER;
  return (
    <group>
      {/* glass partition east toward the server room */}
      <Wall length={9} position={[-11, 0, -9.5]} rotationY={Math.PI / 2} windows={3} />
      {/* south partition: door gap x -16..-14 into the project room */}
      <WallSegments axis="x" fixed={-5} from={-20} to={-11} gaps={[[-16, -14]]} />
      <Door position={[-15, 0, -5]} width={2} />
      <Rug position={[x, 0, z]} radius={3.2} />
      <MeetingTable position={[x, 0, z]} />
      <InstancedChairs slots={MEETING_CHAIR_SLOTS} />
      <Whiteboard position={[-14, 0, -13.4]} rotationY={0} />
      <WallDisplay />
      <Signage text="RUANG MEETING" position={[-15, 2.35, -4.82]} rotationY={Math.PI} scale={0.8} />
      <Plant position={[-19, 0, -6]} scale={1.3} />
      <Plant position={[-11.8, 0, -13]} scale={0.9} />
    </group>
  );
});
