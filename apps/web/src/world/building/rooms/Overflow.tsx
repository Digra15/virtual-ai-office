/**
 * Overflow Desks (ground floor, x -19..-9, z 6..13): the 22 stress-mode
 * workstations (stress-01..22) from layout EXTRA_DESKS — desk + monitor +
 * instanced chairs. Kept dense like a stress-mode bullpen; no boundary
 * walls (the desk grid runs to the room edges).
 */
import { memo, useMemo } from "react";
import {
  EXTRA_DESKS,
  deskChairSlot,
  deskLocalToWorld,
} from "../../layout";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { InstancedChairs } from "../../furniture/Chair";
import { Desk } from "../../furniture/Desk";
import { Monitor } from "../../furniture/Monitor";

export const Overflow = memo(function Overflow() {
  const entries = useMemo(() => Object.entries(EXTRA_DESKS), []);
  const chairSlots = useMemo(
    () => entries.map(([, slot]) => deskChairSlot(slot)),
    [entries],
  );
  return (
    <group>
      {entries.map(([id, slot]) => (
        <group key={id}>
          <Desk position={slot.position} rotationY={slot.rotationY} />
          <Monitor
            position={deskLocalToWorld(slot.position, slot.rotationY, [0, 0, -0.35])}
            rotationY={slot.rotationY}
            accent="#64748b"
          />
        </group>
      ))}
      <InstancedChairs slots={chairSlots} />
      <CeilingLamp position={[-14, 9.5]} />
      <CeilingLamp position={[-14, 12]} />
    </group>
  );
});
