/**
 * Workspace (ground floor, x -10..10, z -5..14): the 8-desk main block
 * (ws-01..ws-08) with monitors, instanced chairs, and low glass dividers
 * between desk pairs — plus the hot-desk bullpen annex (x -8..8, z 6..14)
 * holding the 22 stress-mode workstations (stress-01..22) from
 * layout EXTRA_DESKS. Desk click-to-select behavior is preserved.
 *
 * North edge (z=-5): owned by the server/pantry/restroom rooms (their
 * south walls, with door gaps). West edge (x=-10): owned by the project
 * room (door gap z -1..1). South edge is the building perimeter (shell
 * wall). Owned by this room: the east partition (x=10) with two door gaps
 * into the stair lobby.
 */
import { memo, useMemo } from "react";
import { useAgentStore } from "../../../stores/useAgentStore";
import { STATUS_META } from "../../../utils/status";
import {
  DESKS,
  EXTRA_DESKS,
  deskChairSlot,
  deskLocalToWorld,
  type DeskSlot,
} from "../../layout";
import { InstancedChairs } from "../../furniture/Chair";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { Desk } from "../../furniture/Desk";
import { Door } from "../../furniture/Door";
import { Monitor } from "../../furniture/Monitor";
import { Plant } from "../../furniture/Plant";
import { Rug } from "../../furniture/Rug";
import { Signage } from "../../furniture/Signage";
import { Wall } from "../../furniture/Wall";
import {
  agentCursorHandlers,
  makeAgentClickHandler,
} from "../../interaction/selectAgent";
import { WallSegments } from "./_helpers";

/** One desk setup (desk + monitor). Clicking selects the seated agent. */
const DeskSetup = memo(function DeskSetup({
  wsId,
  slot,
  accent,
}: {
  wsId: string;
  slot: DeskSlot;
  accent: string;
}) {
  const agentId = useAgentStore((s) => {
    for (const a of Object.values(s.agents)) {
      if (a.workstationId === wsId) return a.id;
    }
    return null;
  });
  const onClick = useMemo(
    () => (agentId ? makeAgentClickHandler(agentId, wsId) : undefined),
    [agentId, wsId],
  );
  const cursor = useMemo(
    () => (agentId ? agentCursorHandlers() : undefined),
    [agentId],
  );
  return (
    <group onClick={onClick} {...cursor}>
      <Desk position={slot.position} rotationY={slot.rotationY} />
      <Monitor
        position={deskLocalToWorld(slot.position, slot.rotationY, [0, 0, -0.35])}
        rotationY={slot.rotationY}
        accent={accent}
      />
    </group>
  );
});

/** Hot-desk bullpen annex: the 22 stress-mode workstations. */
const BullpenAnnex = memo(function BullpenAnnex() {
  const entries = useMemo(() => Object.entries(EXTRA_DESKS), []);
  const chairSlots = useMemo(
    () => entries.map(([, slot]) => deskChairSlot(slot)),
    [entries],
  );
  return (
    <group>
      <Signage text="HOT DESKS" position={[9.82, 2.4, 12.5]} rotationY={-Math.PI / 2} scale={0.7} />
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
      <Plant position={[-7.4, 0, 13.3]} />
      <Plant position={[7.4, 0, 13.3]} scale={0.9} />
      <CeilingLamp position={[-4, 10]} />
      <CeilingLamp position={[4, 10]} />
    </group>
  );
});

export const OpenWorkspace = memo(function OpenWorkspace() {
  const agents = useAgentStore((s) => s.agents);

  const entries = useMemo(() => Object.entries(DESKS), []);
  const chairSlots = useMemo(
    () => entries.map(([, slot]) => deskChairSlot(slot)),
    [entries],
  );

  const accentFor = (workstationId: string): string => {
    for (const a of Object.values(agents)) {
      if (a.workstationId === workstationId) return STATUS_META[a.status].color;
    }
    return "#38bdf8";
  };

  return (
    <group>
      {/* east partition: two door gaps into the stair lobby */}
      <WallSegments axis="z" fixed={10} from={-5} to={6} gaps={[[-0.5, 1.5]]} />
      <WallSegments axis="z" fixed={10} from={6} to={14} gaps={[[9, 11]]} />
      <Door position={[10, 0, 0.5]} rotationY={Math.PI / 2} width={2} />
      <Door position={[10, 0, 10]} rotationY={Math.PI / 2} width={2} />

      {entries.map(([wsId, slot]) => (
        <DeskSetup key={wsId} wsId={wsId} slot={slot} accent={accentFor(wsId)} />
      ))}
      <InstancedChairs slots={chairSlots} />
      {/* low glass dividers between desk pairs in each row */}
      {[-5, 0, 5].map((x) => (
        <group key={x}>
          <Wall length={1.8} height={1.4} position={[x, 0, -1.5]} />
          <Wall length={1.8} height={1.4} position={[x, 0, 3.5]} />
        </group>
      ))}
      <Rug position={[0, 0, 1]} radius={5.5} />
      <Plant position={[-9.5, 0, -4.5]} scale={1.2} />
      <Plant position={[9.5, 0, -4.5]} scale={1.2} />
      <CeilingLamp position={[-5, 1]} />
      <CeilingLamp position={[5, 1]} />

      {/* hot-desk bullpen annex (south half of the room) */}
      <BullpenAnnex />
    </group>
  );
});
