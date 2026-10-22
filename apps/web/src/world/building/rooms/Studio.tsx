/**
 * Content Studio (second floor, x -8..20, z 6..14; authored at local y=0):
 * two creative desks (studio-01/02) with monitors. Kept deliberately
 * sparse for mesh count.
 *
 * North edge (z=6) is owned by the Corridors room (wall + door gap at
 * x 1..3); this room hangs the door and owns the west partition (x=-8)
 * separating it from the focus room. East/south edges are the building
 * perimeter (shell walls).
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
import { WallSegments, localDeskSlot } from "./_helpers";

/** One creative desk: desk + monitor + chair. */
const StudioDesk = memo(function StudioDesk({ slot }: { slot: DeskSlot }) {
  const chair = useMemo(() => deskChairSlot(slot), [slot]);
  return (
    <group>
      <Desk position={slot.position} rotationY={slot.rotationY} />
      <Monitor
        position={deskLocalToWorld(slot.position, slot.rotationY, [0, 0, -0.35])}
        rotationY={slot.rotationY}
        accent="#f472b6"
      />
      <Chair position={chair.position} rotationY={chair.rotationY} />
    </group>
  );
});

export const Studio = memo(function Studio() {
  const slots = useMemo(
    () => ["studio-01", "studio-02"].map((id) => localDeskSlot(WORKSTATIONS[id])),
    [],
  );
  return (
    <group>
      {/* west partition against the focus room */}
      <WallSegments axis="z" fixed={-8} from={6} to={14} />
      {/* door on the north edge (wall owned by Corridors) */}
      <Door position={[2, 0, 6]} width={1.8} />
      <Signage text="CONTENT STUDIO" position={[2, 2.35, 6.15]} scale={0.75} />
      {slots.map((slot, i) => (
        <StudioDesk key={i} slot={slot} />
      ))}
      <Plant position={[19.2, 0, 13.2]} />
      <Plant position={[-7.2, 0, 13.2]} scale={0.85} />
      <CeilingLamp position={[5, 10]} />
    </group>
  );
});
