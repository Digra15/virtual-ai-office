/**
 * Open Workspace (ground floor, x -10..10, z -4..7): the 8-desk main block
 * (ws-01..ws-08) with monitors, instanced chairs, low glass dividers between
 * desk pairs and low boundary partitions. Desk click-to-select behavior is
 * preserved from the original scene.
 */
import { memo, useMemo } from "react";
import { useAgentStore } from "../../../stores/useAgentStore";
import { STATUS_META } from "../../../utils/status";
import {
  DESKS,
  deskChairSlot,
  deskLocalToWorld,
  type DeskSlot,
} from "../../layout";
import { InstancedChairs } from "../../furniture/Chair";
import { Desk } from "../../furniture/Desk";
import { Monitor } from "../../furniture/Monitor";
import { Plant } from "../../furniture/Plant";
import { Rug } from "../../furniture/Rug";
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
      {/* low boundary partitions (walkways stay clear inside) */}
      <WallSegments axis="x" fixed={-4} from={-10} to={10} />
      <WallSegments axis="x" fixed={7} from={-8.5} to={10} />
      <WallSegments axis="z" fixed={-10} from={-4} to={7} />
      <WallSegments axis="z" fixed={10} from={-4} to={7} />
      <Rug position={[0, 0, 1]} radius={5.5} />
      <Plant position={[-9.5, 0, 6.5]} scale={1.2} />
      <Plant position={[9.5, 0, -3.5]} scale={1.2} />
    </group>
  );
});
