/**
 * Focus Rooms (second floor; authored at local y=0): two small full-height
 * quiet rooms, each with one desk (focus-01/focus-02), a soft lamp and a plant.
 */
import { memo, useMemo } from "react";
import {
  deskChairSlot,
  deskLocalToWorld,
  type DeskSlot,
} from "../../layout";
import { WORKSTATIONS } from "../floorPlan";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { Chair } from "../../furniture/Chair";
import { Desk } from "../../furniture/Desk";
import { Monitor } from "../../furniture/Monitor";
import { Plant } from "../../furniture/Plant";
import { Wall } from "../../furniture/Wall";
import { Door } from "../../furniture/Door";
import { Signage } from "../../furniture/Signage";
import { WallSegments, localDeskSlot } from "./_helpers";

/** One focus desk: desk + monitor + chair. */
const FocusDesk = memo(function FocusDesk({ wsId }: { wsId: string }) {
  const slot: DeskSlot = useMemo(() => localDeskSlot(WORKSTATIONS[wsId]), [wsId]);
  const chair = useMemo(() => deskChairSlot(slot), [slot]);
  return (
    <group>
      <Desk position={slot.position} rotationY={slot.rotationY} />
      <Monitor
        position={deskLocalToWorld(slot.position, slot.rotationY, [0, 0, -0.35])}
        rotationY={slot.rotationY}
        accent="#a78bfa"
      />
      <Chair position={chair.position} rotationY={chair.rotationY} />
    </group>
  );
});

const H = 3.2; // full-height privacy walls

/** Focus Room A (x -20..-14, z -4..3). */
export const FocusRoomA = memo(function FocusRoomA() {
  return (
    <group>
      {/* north wall (door gap x -15..-13, clipped to the room edge) */}
      <WallSegments axis="x" fixed={-4} from={-20} to={-14} gaps={[[-15, -13]]} height={H} />
      {/* south wall (door gap x -18..-16) */}
      <WallSegments axis="x" fixed={3} from={-20} to={-14} gaps={[[-18, -16]]} height={H} />
      <Wall length={7} position={[-14, 0, -0.5]} rotationY={Math.PI / 2} height={H} />
      <Door position={[-14.5, 0, -4]} width={1.6} />
      <Door position={[-17, 0, 3]} width={1.6} />
      <FocusDesk wsId="focus-01" />
      <Signage text="FOCUS A" position={[-17, 2.3, 2.85]} rotationY={Math.PI} />
      <Plant position={[-19.3, 0, 2.3]} scale={0.9} />
      <CeilingLamp position={[-17, -0.5]} />
    </group>
  );
});

/** Focus Room B (x -13..-7.5, z -4..3). */
export const FocusRoomB = memo(function FocusRoomB() {
  return (
    <group>
      <WallSegments axis="x" fixed={-4} from={-13} to={-7.5} height={H} />
      <WallSegments axis="x" fixed={3} from={-13} to={-7.5} gaps={[[-11, -9]]} height={H} />
      <Wall length={7} position={[-13, 0, -0.5]} rotationY={Math.PI / 2} height={H} />
      <Wall length={7} position={[-7.5, 0, -0.5]} rotationY={Math.PI / 2} height={H} />
      <Door position={[-10, 0, 3]} width={1.6} />
      <FocusDesk wsId="focus-02" />
      <Signage text="FOCUS B" position={[-10, 2.3, 2.85]} rotationY={Math.PI} />
      <Plant position={[-8.2, 0, 2.3]} scale={0.9} />
      <CeilingLamp position={[-10, -0.5]} />
    </group>
  );
});
