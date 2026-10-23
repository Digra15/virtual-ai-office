import { memo } from "react";
import { InstancedChairs, type ChairSlot } from "../furniture/Chair";
import { MeetingTable } from "../furniture/MeetingTable";
import { Rug } from "../furniture/Rug";

/**
 * Meeting chair slots for the single-floor Ruang Meeting
 * (x 9.5..16, z -1.8..10; conference table center (12.8, 4.4)).
 *
 * Also the agent seats used by A2A meetings — imported by
 * stores/useMeetingStore. Each chair faces the table:
 *   west row (x=11.1) faces +X (rotationY = PI/2)
 *   east row (x=14.5) faces -X (rotationY = -PI/2)
 *   head chairs face the table along Z.
 */
export const MEETING_CHAIR_SLOTS: ChairSlot[] = [
  // west side — face east toward the table
  { position: [11.1, 0, 2.6], rotationY: Math.PI / 2 },
  { position: [11.1, 0, 3.8], rotationY: Math.PI / 2 },
  { position: [11.1, 0, 5.0], rotationY: Math.PI / 2 },
  { position: [11.1, 0, 6.2], rotationY: Math.PI / 2 },
  // east side — face west toward the table
  { position: [14.5, 0, 2.6], rotationY: -Math.PI / 2 },
  { position: [14.5, 0, 3.8], rotationY: -Math.PI / 2 },
  { position: [14.5, 0, 5.0], rotationY: -Math.PI / 2 },
  { position: [14.5, 0, 6.2], rotationY: -Math.PI / 2 },
  // head chairs — host seats
  { position: [12.8, 0, 1.2], rotationY: 0 },
  { position: [12.8, 0, 7.6], rotationY: Math.PI },
];

/** Table center — meeting participants face this point. */
export const MEETING_TABLE_CENTER = { x: 12.8, z: 4.4 } as const;

/**
 * Legacy single-floor meeting room component (kept import-consistent with
 * MEETING_CHAIR_SLOTS; the building composer renders
 * world/building/rooms/MeetingRoom instead).
 */
export const MeetingRoom = memo(function MeetingRoom() {
  return (
    <group>
      <Rug position={[12.8, 0, 4.4]} radius={3.4} />
      <MeetingTable position={[12.8, 0, 4.4]} />
      <InstancedChairs slots={MEETING_CHAIR_SLOTS} />
    </group>
  );
});
