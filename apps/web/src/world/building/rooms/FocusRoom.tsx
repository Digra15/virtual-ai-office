/**
 * Focus Room (second floor, x -20..-8, z 6..14; authored at local y=0):
 * one quiet desk (focus-01), a plant, a ceiling lamp.
 *
 * North edge (z=6) is owned by the Corridors room (wall + door gap at
 * x -15..-13); this room hangs the door. West/south edges are the
 * building perimeter (shell walls); the east partition (x=-8) is owned
 * by the Studio room.
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
import { localDeskSlot } from "./_helpers";

export const FocusRoom = memo(function FocusRoom() {
  const slot: DeskSlot = useMemo(() => localDeskSlot(WORKSTATIONS["focus-01"]), []);
  const chair = useMemo(() => deskChairSlot(slot), [slot]);
  return (
    <group>
      {/* door on the north edge (wall owned by Corridors) */}
      <Door position={[-14, 0, 6]} width={1.6} />
      <Signage text="FOCUS" position={[-14, 2.35, 6.15]} scale={0.7} />
      <Desk position={slot.position} rotationY={slot.rotationY} />
      <Monitor
        position={deskLocalToWorld(slot.position, slot.rotationY, [0, 0, -0.35])}
        rotationY={slot.rotationY}
        accent="#a78bfa"
      />
      <Chair position={chair.position} rotationY={chair.rotationY} />
      <Plant position={[-19.2, 0, 13.2]} scale={0.9} />
      <CeilingLamp position={[-14, 10]} />
    </group>
  );
});
