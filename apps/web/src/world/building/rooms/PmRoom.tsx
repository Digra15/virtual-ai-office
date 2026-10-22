/**
 * Project Management room (ground floor, x 11..20, z -14..-5): DIFIA's desk
 * (pm-01) facing a BIG live Kanban screen on the north wall, plus a planning
 * table. The screen subscribes narrowly to task counts so only it re-renders.
 */
import { memo, useMemo } from "react";
import { Text } from "@react-three/drei";
import { useTaskStore } from "../../../stores/useTaskStore";
import {
  deskChairSlot,
  deskLocalToWorld,
  type DeskSlot,
} from "../../layout";
import { WORKSTATIONS } from "../floorPlan";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { Chair } from "../../furniture/Chair";
import { Desk } from "../../furniture/Desk";
import { MeetingTable } from "../../furniture/MeetingTable";
import { Monitor } from "../../furniture/Monitor";
import { Plant } from "../../furniture/Plant";
import { geoBox, geoPlane } from "../../geometries";
import { Door } from "../../furniture/Door";
import { Signage } from "../../furniture/Signage";
import { matPanelDark } from "./_fallback";
import { WallSegments } from "./_helpers";

/** Live Kanban board screen — re-renders only when tasks change. */
const KanbanScreen = memo(function KanbanScreen() {
  const tasks = useTaskStore((s) => s.tasks);
  const counts = useMemo(() => {
    const c = { todo: 0, in_progress: 0, review: 0, done: 0 };
    for (const t of tasks) c[t.status] += 1;
    return c;
  }, [tasks]);
  const line = `TO DO ${counts.todo}  •  IN PROGRESS ${counts.in_progress}  •  REVIEW ${counts.review}  •  DONE ${counts.done}`;
  return (
    <group position={[15.5, 0, -13.82]}>
      <mesh geometry={geoBox} material={matPanelDark} scale={[7.4, 3.1, 0.12]} position={[0, 2.0, 0]} />
      <mesh geometry={geoPlane} position={[0, 2.0, 0.07]} scale={[7.1, 2.8, 1]}>
        <meshBasicMaterial color="#0c1a2e" />
      </mesh>
      <Text position={[0, 2.85, 0.09]} fontSize={0.34} color="#7dd3fc" anchorX="center" anchorY="middle">
        PROJECT KANBAN — LIVE
      </Text>
      <Text
        position={[0, 2.05, 0.09]}
        fontSize={0.27}
        color="#e2e8f0"
        anchorX="center"
        anchorY="middle"
        maxWidth={6.8}
        textAlign="center"
      >
        {line}
      </Text>
      <Text position={[0, 1.3, 0.09]} fontSize={0.2} color="#64748b" anchorX="center" anchorY="middle">
        DIFIA • PROJECT MANAGEMENT
      </Text>
    </group>
  );
});

export const PmRoom = memo(function PmRoom() {
  const ws = WORKSTATIONS["pm-01"];
  const slot: DeskSlot = useMemo(
    () => ({ position: ws.position, rotationY: ws.rotationY, zone: ws.roomId }),
    [ws],
  );
  const chair = useMemo(() => deskChairSlot(slot), [slot]);
  return (
    <group>
      {/* west partition with the door gap (z -10.5..-8.5), south partition */}
      <WallSegments axis="z" fixed={11} from={-14} to={-5} gaps={[[-10.5, -8.5]]} />
      <WallSegments axis="x" fixed={-5} from={11} to={20} />
      <Door position={[11, 0, -9.5]} rotationY={Math.PI / 2} width={2} />
      {/* DIFIA's desk facing the Kanban screen */}
      <Desk position={slot.position} rotationY={slot.rotationY} />
      <Monitor
        position={deskLocalToWorld(slot.position, slot.rotationY, [0, 0, -0.35])}
        rotationY={slot.rotationY}
        accent="#c084fc"
      />
      <Chair position={chair.position} rotationY={chair.rotationY} />
      <KanbanScreen />
      {/* planning table */}
      <MeetingTable position={[15.5, 0, -6.4]} />
      <Chair position={[14.2, 0, -6.4]} rotationY={Math.PI / 2} />
      <Chair position={[16.8, 0, -6.4]} rotationY={-Math.PI / 2} />
      <Signage text="PROJECT MANAGEMENT" position={[16, 2.3, -5.15]} rotationY={Math.PI} scale={0.6} />
      <Plant position={[19.3, 0, -5.8]} />
      <Plant position={[11.7, 0, -13.3]} scale={0.9} />
      <CeilingLamp position={[15.5, -9.5]} />
    </group>
  );
});
