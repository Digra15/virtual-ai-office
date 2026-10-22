import { memo } from "react";
import { InstancedChairs, type ChairSlot } from "../furniture/Chair";
import { MeetingTable } from "../furniture/MeetingTable";
import { Plant } from "../furniture/Plant";
import { Rug } from "../furniture/Rug";
import { Wall } from "../furniture/Wall";
import { Whiteboard } from "../furniture/Whiteboard";

const CHAIR_SLOTS: ChairSlot[] = [
  { position: [-16.2, 0, -9.5], rotationY: Math.PI / 2 },
  { position: [-11.8, 0, -9.5], rotationY: -Math.PI / 2 },
  { position: [-15.2, 0, -11], rotationY: 0 },
  { position: [-12.8, 0, -11], rotationY: 0 },
  { position: [-15.2, 0, -8], rotationY: Math.PI },
  { position: [-12.8, 0, -8], rotationY: Math.PI },
];

/**
 * Meeting room (north-west): long table, six chairs, whiteboard on the north
 * wall, glass partitions toward the open workspace.
 */
export const MeetingRoom = memo(function MeetingRoom() {
  return (
    <group>
      <Rug position={[-14, 0, -9.5]} radius={3.2} />
      <MeetingTable position={[-14, 0, -9.5]} />
      <InstancedChairs slots={CHAIR_SLOTS} />
      <Whiteboard position={[-14, 0, -13.4]} rotationY={0} />
      {/* glass partitions: east toward open space, south toward corridor */}
      <Wall length={9} position={[-8, 0, -9.5]} rotationY={Math.PI / 2} windows={3} />
      <Wall length={12} position={[-14, 0, -5]} rotationY={0} windows={4} />
      <Plant position={[-19, 0, -6]} scale={1.3} />
    </group>
  );
});
