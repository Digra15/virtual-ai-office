/**
 * Ruang Fokus (second floor, x -20..-12, z -4..5; authored at local y=0):
 * one quiet desk (focus-01), a plant, a ceiling lamp.
 *
 * North edge (z=-4): owned by the direksi room (its south wall runs
 * x -20..-9, no door gap here). West/south edges are the building
 * perimeter (shell walls). Owned by this room: the east partition (x=-12,
 * door gap z -1..1 into the lounge) and the south partition (z=5, door gap
 * x -17..-15 into the pemulihan room).
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
import { Door } from "../../furniture/Door";
import { Signage } from "../../furniture/Signage";
import { localDeskSlot, WallSegments } from "./_helpers";

export const FocusRoom = memo(function FocusRoom() {
  const slot: DeskSlot = useMemo(() => localDeskSlot(WORKSTATIONS["focus-01"]), []);
  const chair = useMemo(() => deskChairSlot(slot), [slot]);
  return (
    <group>
      {/* east partition: door gap z -1..1 into the lounge */}
      <WallSegments axis="z" fixed={-12} from={-4} to={5} gaps={[[-1, 1]]} />
      {/* south partition: door gap x -17..-15 into the pemulihan room */}
      <WallSegments axis="x" fixed={5} from={-20} to={-12} gaps={[[-17, -15]]} />
      <Door position={[-12, 0, 0]} rotationY={Math.PI / 2} width={1.6} />
      <Door position={[-16, 0, 5]} width={1.6} />
      <Signage text="RUANG FOKUS" position={[-12.18, 2.35, 0]} rotationY={-Math.PI / 2} scale={0.7} />
      <Desk position={slot.position} rotationY={slot.rotationY} />
      <Monitor
        position={deskLocalToWorld(slot.position, slot.rotationY, [0, 0, -0.35])}
        rotationY={slot.rotationY}
        accent="#a78bfa"
      />
      <Chair position={chair.position} rotationY={chair.rotationY} />
      <Plant position={[-19.2, 0, 4.2]} scale={0.9} />
      <Plant position={[-19.2, 0, -3.2]} scale={0.9} />
      <CeilingLamp position={[-16, 0]} />
    </group>
  );
});
