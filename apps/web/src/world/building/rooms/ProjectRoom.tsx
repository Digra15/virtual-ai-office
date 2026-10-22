/**
 * Ruang Project (ground floor, x -20..-10, z -5..6; authored at local y=0):
 * the collaboration room — a planning table with chairs, a whiteboard, and
 * a LIVE project board wall screen subscribed to the real useTaskStore
 * (per-column counts + top card titles; the old PM room's screen, folded
 * back here from the workspace wall).
 *
 * North edge (z=-5): owned by the meeting room (door gap x -16..-14) —
 * this room hangs the door. West/south edges are the building perimeter
 * (shell walls); the east partition (x=-10) is owned by this room.
 */
import { memo, useMemo } from "react";
import { Text } from "@react-three/drei";
import { useTaskStore, type TaskStatus } from "../../../stores/useTaskStore";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { Door } from "../../furniture/Door";
import { InstancedChairs } from "../../furniture/Chair";
import { MeetingTable } from "../../furniture/MeetingTable";
import { Plant } from "../../furniture/Plant";
import { Rug } from "../../furniture/Rug";
import { Signage } from "../../furniture/Signage";
import { Whiteboard } from "../../furniture/Whiteboard";
import { geoBox, geoPlane } from "../../geometries";
import { matPanelDark } from "./_fallback";
import { WallSegments } from "./_helpers";

const COLUMNS: { status: TaskStatus; label: string; color: string; x: number }[] = [
  { status: "todo", label: "TODO", color: "#fbbf24", x: -1.95 },
  { status: "in_progress", label: "PROG", color: "#38bdf8", x: -0.65 },
  { status: "review", label: "REVIEW", color: "#c084fc", x: 0.65 },
  { status: "done", label: "DONE", color: "#34d399", x: 1.95 },
];

/** Live project board — re-renders only when the task list changes. */
const ProjectBoard = memo(function ProjectBoard() {
  const tasks = useTaskStore((s) => s.tasks);
  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, { title: string }[]>();
    for (const c of COLUMNS) map.set(c.status, []);
    for (const t of tasks) map.get(t.status)?.push(t);
    return map;
  }, [tasks]);
  return (
    <group position={[-19.85, 0, 0.5]} rotation={[0, Math.PI / 2, 0]}>
      <mesh geometry={geoBox} material={matPanelDark} scale={[6.4, 3.1, 0.12]} position={[0, 2.0, 0]} />
      <mesh geometry={geoPlane} position={[0, 2.0, 0.07]} scale={[6.1, 2.85, 1]}>
        <meshBasicMaterial color="#0b1526" />
      </mesh>
      <Text position={[0, 3.28, 0.09]} fontSize={0.3} color="#7dd3fc" anchorX="center" anchorY="middle">
        PROJECT BOARD — LIVE
      </Text>
      {COLUMNS.map((c) => {
        const cards = byStatus.get(c.status) ?? [];
        return (
          <group key={c.status} position={[c.x, 0, 0]}>
            <Text position={[0, 2.78, 0.09]} fontSize={0.24} color={c.color} anchorX="center" anchorY="middle">
              {`${c.label} ${cards.length}`}
            </Text>
            {cards.slice(0, 4).map((t, i) => (
              <Text
                key={t.title}
                position={[0, 2.3 - i * 0.42, 0.09]}
                fontSize={0.17}
                color="#cbd5e1"
                anchorX="center"
                anchorY="middle"
                maxWidth={2.3}
              >
                {t.title.length > 26 ? `${t.title.slice(0, 25)}…` : t.title}
              </Text>
            ))}
          </group>
        );
      })}
      <Text position={[0, 0.62, 0.09]} fontSize={0.16} color="#64748b" anchorX="center" anchorY="middle">
        synced with the Kanban store
      </Text>
    </group>
  );
});

const TABLE_CHAIRS = [
  { position: [-16.6, 0, 0.5] as const, rot: Math.PI / 2 },
  { position: [-13.4, 0, 0.5] as const, rot: -Math.PI / 2 },
  { position: [-15.6, 0, -1.1] as const, rot: 0 },
  { position: [-14.4, 0, -1.1] as const, rot: 0 },
  { position: [-15.6, 0, 2.1] as const, rot: Math.PI },
  { position: [-14.4, 0, 2.1] as const, rot: Math.PI },
];

export const ProjectRoom = memo(function ProjectRoom() {
  return (
    <group>
      {/* east partition against the workspace, door gap z -1..1 */}
      <WallSegments axis="z" fixed={-10} from={-5} to={6} gaps={[[-1, 1]]} />
      {/* south partition (reception is beyond, no door) */}
      <WallSegments axis="x" fixed={6} from={-20} to={-10} />
      {/* door on the north edge (wall owned by the meeting room) */}
      <Door position={[-15, 0, -5]} width={2} />
      <Signage text="RUANG PROJECT" position={[-15, 2.35, -4.82]} rotationY={Math.PI} scale={0.75} />

      {/* live project board on the west wall */}
      <ProjectBoard />

      {/* planning table */}
      <Rug position={[-15, 0, 0.5]} radius={3} />
      <MeetingTable position={[-15, 0, 0.5]} />
      <InstancedChairs
        slots={TABLE_CHAIRS.map(({ position: [x, , z], rot }) => ({
          position: [x, 0, z] as [number, number, number],
          rotationY: rot,
        }))}
      />

      <Whiteboard position={[-12, 0, 5.4]} rotationY={Math.PI} />
      <Plant position={[-19.2, 0, 5.2]} />
      <Plant position={[-10.8, 0, 5.2]} scale={0.85} />
      <CeilingLamp position={[-15, 0.5]} />
    </group>
  );
});
