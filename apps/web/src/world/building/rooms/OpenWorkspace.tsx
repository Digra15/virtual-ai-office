/**
 * Open Workspace (ground floor, x -10..10, z -4..7): the 8-desk main block
 * (ws-01..ws-08) with monitors, instanced chairs, low glass dividers between
 * desk pairs and low boundary partitions. Desk click-to-select behavior is
 * preserved from the original scene.
 */
import { memo, useMemo } from "react";
import { Text } from "@react-three/drei";
import { useAgentStore } from "../../../stores/useAgentStore";
import { useTaskStore } from "../../../stores/useTaskStore";
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
import { geoBox, geoPlane } from "../../geometries";
import {
  agentCursorHandlers,
  makeAgentClickHandler,
} from "../../interaction/selectAgent";
import { matPanelDark } from "./_fallback";
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

/** Live Kanban board screen on the east wall (folded in from the cut PM
 *  room). Subscribes narrowly to task counts so only it re-renders. */
const KanbanScreen = memo(function KanbanScreen() {
  const tasks = useTaskStore((s) => s.tasks);
  const counts = useMemo(() => {
    const c = { todo: 0, in_progress: 0, review: 0, done: 0 };
    for (const t of tasks) c[t.status] += 1;
    return c;
  }, [tasks]);
  const line = `TODO ${counts.todo} • PROG ${counts.in_progress} • REVIEW ${counts.review} • DONE ${counts.done}`;
  return (
    <group position={[9.82, 0, 1.2]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh geometry={geoBox} material={matPanelDark} scale={[4.2, 2.2, 0.1]} position={[0, 2.0, 0]} />
      <mesh geometry={geoPlane} position={[0, 2.0, 0.06]} scale={[3.9, 1.9, 1]}>
        <meshBasicMaterial color="#0c1a2e" />
      </mesh>
      <Text position={[0, 2.72, 0.08]} fontSize={0.28} color="#7dd3fc" anchorX="center" anchorY="middle">
        KANBAN — LIVE
      </Text>
      <Text
        position={[0, 2.0, 0.08]}
        fontSize={0.21}
        color="#e2e8f0"
        anchorX="center"
        anchorY="middle"
        maxWidth={3.6}
        textAlign="center"
      >
        {line}
      </Text>
      <Text position={[0, 1.34, 0.08]} fontSize={0.17} color="#64748b" anchorX="center" anchorY="middle">
        PROJECT MANAGEMENT
      </Text>
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
      {/* live Kanban wall screen (folded in from the cut PM room) */}
      <KanbanScreen />
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
