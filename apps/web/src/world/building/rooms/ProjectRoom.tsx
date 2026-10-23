/**
 * Ruang Project (x -16..-6.5, z 1..10): boss desk + pink rug + bookshelf,
 * boss chair + 2 guest chairs, and the LIVE Kanban board subscribed to
 * the real useTaskStore (per-column counts + top card titles) — the
 * wiring from the old room, restyled with a cozy wood frame and mounted
 * on the north wall (z=1.0).
 */
import { memo, useMemo } from "react";
import * as THREE from "three";
import { RoundedBox, Text } from "@react-three/drei";
import { useTaskStore, type TaskStatus } from "../../../stores/useTaskStore";
import { CozyChair, CozyPlant } from "../../cozy";
import { geoBox, geoCircle, geoPlane } from "../../geometries";

const matDeskWood = new THREE.MeshStandardMaterial({ color: "#9a6a3b", roughness: 0.6 });
const matDeskLeg = new THREE.MeshStandardMaterial({ color: "#2b323e", roughness: 0.5, metalness: 0.5 });
const matRugPink = new THREE.MeshStandardMaterial({ color: "#f9a8d4", roughness: 0.95 });
const matShelf = new THREE.MeshStandardMaterial({ color: "#6b4a2f", roughness: 0.8 });
const matBoardFrame = new THREE.MeshStandardMaterial({ color: "#8a5a33", roughness: 0.65 });
const matBoardBg = new THREE.MeshStandardMaterial({ color: "#0b1526", roughness: 0.6 });

const BOOK_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7"];

const COLUMNS: { status: TaskStatus; label: string; color: string; x: number }[] = [
  { status: "todo", label: "TODO", color: "#fbbf24", x: -1.95 },
  { status: "in_progress", label: "PROG", color: "#38bdf8", x: -0.65 },
  { status: "review", label: "REVIEW", color: "#c084fc", x: 0.65 },
  { status: "done", label: "DONE", color: "#34d399", x: 1.95 },
];

/**
 * Live project board — re-renders only when the task list changes.
 * Mounted flat on the north wall (z=1.0), facing +Z into the room.
 */
const ProjectBoard = memo(function ProjectBoard() {
  const tasks = useTaskStore((s) => s.tasks);
  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, { title: string }[]>();
    for (const c of COLUMNS) map.set(c.status, []);
    for (const t of tasks) map.get(t.status)?.push(t);
    return map;
  }, [tasks]);
  return (
    <group position={[-11.5, 0, 1.16]}>
      {/* cozy wood frame */}
      <RoundedBox args={[6.7, 3.4, 0.14]} radius={0.04} smoothness={4} position={[0, 2.0, -0.02]} castShadow>
        <meshStandardMaterial color={matBoardFrame.color} roughness={0.65} />
      </RoundedBox>
      <mesh geometry={geoPlane} position={[0, 2.0, 0.06]} scale={[6.4, 3.1, 1]}>
        <meshBasicMaterial color={matBoardBg.color} />
      </mesh>
      <Text position={[0, 3.28, 0.08]} fontSize={0.3} color="#7dd3fc" anchorX="center" anchorY="middle">
        PROJECT BOARD — LIVE
      </Text>
      {COLUMNS.map((c) => {
        const cards = byStatus.get(c.status) ?? [];
        return (
          <group key={c.status} position={[c.x, 0, 0]}>
            <Text position={[0, 2.78, 0.08]} fontSize={0.24} color={c.color} anchorX="center" anchorY="middle">
              {`${c.label} ${cards.length}`}
            </Text>
            {cards.slice(0, 4).map((t, i) => (
              <Text
                key={t.title}
                position={[0, 2.3 - i * 0.42, 0.08]}
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
      <Text position={[0, 0.62, 0.08]} fontSize={0.16} color="#64748b" anchorX="center" anchorY="middle">
        synced with the Kanban store
      </Text>
    </group>
  );
});

/** Boss desk at (-11.5,5.5) on the pink rug. */
const BossDesk = memo(function BossDesk() {
  return (
    <group position={[-11.5, 0, 5.5]}>
      {/* pink rug */}
      <mesh geometry={geoCircle} material={matRugPink} rotation={[-Math.PI / 2, 0, 0]} scale={[2.2, 2.2, 1]} position={[0, 0.015, 0.4]} receiveShadow />
      {/* desk */}
      <mesh geometry={geoBox} material={matDeskWood} scale={[1.8, 0.07, 0.9]} position={[0, 0.73, 0]} castShadow receiveShadow />
      {[
        [-0.82, -0.38],
        [0.82, -0.38],
        [-0.82, 0.38],
        [0.82, 0.38],
      ].map(([lx, lz]) => (
        <mesh key={`${lx}:${lz}`} geometry={geoBox} material={matDeskLeg} scale={[0.07, 0.73, 0.07]} position={[lx, 0.365, lz]} />
      ))}
    </group>
  );
});

/** Bookshelf against the west wall. */
const Bookshelf = memo(function Bookshelf() {
  return (
    <group position={[-15.55, 0, 5.5]} rotation={[0, Math.PI / 2, 0]}>
      <mesh geometry={geoBox} material={matShelf} scale={[1.8, 2.0, 0.4]} position={[0, 1.0, 0]} castShadow />
      {[0.5, 1.0, 1.5].map((y) => (
        <mesh key={y} geometry={geoBox} material={matDeskWood} scale={[1.7, 0.05, 0.36]} position={[0, y, 0.01]} />
      ))}
      {[0.5, 1.0, 1.5].map((y, si) =>
        Array.from({ length: 7 }, (_, i) => (
          <mesh
            key={`${si}:${i}`}
            geometry={geoBox}
            scale={[0.16, 0.32, 0.26]}
            position={[-0.7 + i * 0.22, y + 0.21, 0.01]}
          >
            <meshStandardMaterial color={BOOK_COLORS[(i + si) % BOOK_COLORS.length]} roughness={0.85} />
          </mesh>
        )),
      )}
    </group>
  );
});

export const ProjectRoom = memo(function ProjectRoom() {
  return (
    <group>
      <ProjectBoard />
      <BossDesk />
      <Bookshelf />
      {/* boss chair north of the desk, pink-striped, faces the guests */}
      <CozyChair position={[-11.5, 0, 4.8]} rotationY={0} pinkStripe />
      {/* 2 guest chairs facing north toward the boss desk */}
      <CozyChair position={[-12.5, 0, 6.4]} rotationY={Math.PI} />
      <CozyChair position={[-10.5, 0, 6.4]} rotationY={Math.PI} />
      <CozyPlant position={[-7.3, 0, 8.8]} scale={1.1} />
      <CozyPlant position={[-15.2, 0, 2.0]} scale={0.9} />
    </group>
  );
});
