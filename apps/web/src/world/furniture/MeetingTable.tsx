import { memo } from "react";
import { geoBox } from "../geometries";
import { matDeskLeg, matMeetingTop } from "../materials";

interface MeetingTableProps {
  position?: [number, number, number];
  rotationY?: number;
}

/** Long meeting table with two panel legs. */
export const MeetingTable = memo(function MeetingTable({
  position = [0, 0, 0],
  rotationY = 0,
}: MeetingTableProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geoBox} material={matMeetingTop} scale={[3.4, 0.09, 1.5]} position={[0, 0.74, 0]} castShadow receiveShadow />
      <mesh geometry={geoBox} material={matDeskLeg} scale={[0.08, 0.7, 1.2]} position={[-1.35, 0.35, 0]} />
      <mesh geometry={geoBox} material={matDeskLeg} scale={[0.08, 0.7, 1.2]} position={[1.35, 0.35, 0]} />
    </group>
  );
});
