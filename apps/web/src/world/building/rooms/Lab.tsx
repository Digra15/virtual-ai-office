/**
 * R&D Laboratory (second floor, x -7..5, z -14..-7; authored at local y=0):
 * three experiment desks (lab-01..03), each with two monitors, whiteboard,
 * shelf.
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
import { Shelf } from "../../furniture/Shelf";
import { Whiteboard } from "../../furniture/Whiteboard";
import { Door } from "../../furniture/Door";
import { Signage } from "../../furniture/Signage";
import { WallSegments, localDeskSlot } from "./_helpers";

const LAB_IDS = ["lab-01", "lab-02", "lab-03"] as const;

/** One experiment desk: desk + two monitors + chair. */
const LabDesk = memo(function LabDesk({ slot }: { slot: DeskSlot }) {
  const chair = useMemo(() => deskChairSlot(slot), [slot]);
  const monL = useMemo(
    () => deskLocalToWorld(slot.position, slot.rotationY, [-0.55, 0, -0.35]),
    [slot],
  );
  const monR = useMemo(
    () => deskLocalToWorld(slot.position, slot.rotationY, [0.55, 0, -0.35]),
    [slot],
  );
  return (
    <group>
      <Desk position={slot.position} rotationY={slot.rotationY} />
      <Monitor position={monL} rotationY={slot.rotationY} accent="#4ade80" />
      <Monitor position={monR} rotationY={slot.rotationY} accent="#22d3ee" />
      <Chair position={chair.position} rotationY={chair.rotationY} />
    </group>
  );
});

export const Lab = memo(function Lab() {
  const slots = useMemo(
    () => LAB_IDS.map((id) => localDeskSlot(WORKSTATIONS[id])),
    [],
  );
  return (
    <group>
      {/* south wall toward the north corridor (door gap x -2..0); west + east */}
      <WallSegments axis="x" fixed={-7} from={-7} to={5} gaps={[[-2, 0]]} />
      <WallSegments axis="z" fixed={-7} from={-14} to={-7} />
      <WallSegments axis="z" fixed={5} from={-14} to={-7} />
      <Door position={[-1, 0, -7]} width={2} />
      {slots.map((slot, i) => (
        <LabDesk key={LAB_IDS[i]} slot={slot} />
      ))}
      <Whiteboard position={[2.5, 0, -13.35]} rotationY={0} />
      <Shelf position={[-6.2, 0, -13.5]} rotationY={0} />
      <Signage text="R&D LAB" position={[-1, 2.3, -7.15]} rotationY={Math.PI} />
      <Plant position={[4.5, 0, -7.6]} />
      <CeilingLamp position={[0, -10.5]} />
    </group>
  );
});
