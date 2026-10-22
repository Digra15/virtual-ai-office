/**
 * Ruang R&D (second floor, x 1..16, z 5..14; authored at local y=0):
 * the research & development lab — dev desks with dual monitors, an
 * experiment whiteboard, and a parts shelf. Desks here are visual dressing
 * (spawnable workstations live in the ground-floor hot-desk bullpen).
 *
 * South edge is the building perimeter (shell wall). The west partition
 * (x=1, door gap z 8..10 into the garden hall), the north partition (z=5),
 * and the east partition (x=16, door gap z 8..10 into the south-east
 * lobby) are owned by this room.
 */
import { memo } from "react";
import * as THREE from "three";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { Chair } from "../../furniture/Chair";
import { Desk } from "../../furniture/Desk";
import { Door } from "../../furniture/Door";
import { Monitor } from "../../furniture/Monitor";
import { Plant } from "../../furniture/Plant";
import { Shelf } from "../../furniture/Shelf";
import { Signage } from "../../furniture/Signage";
import { Whiteboard } from "../../furniture/Whiteboard";
import { geoBox } from "../../geometries";
import { deskChairSlot, deskLocalToWorld } from "../../layout";
import { WallSegments } from "./_helpers";

const matBoard = new THREE.MeshStandardMaterial({ color: "#78350f", roughness: 0.8 });

const DEV_DESKS: { x: number; z: number; rot: number; accent: string }[] = [
  { x: 5, z: 8, rot: 0, accent: "#22d3ee" },
  { x: 9, z: 8, rot: 0, accent: "#a78bfa" },
  { x: 5, z: 12, rot: Math.PI, accent: "#34d399" },
  { x: 9, z: 12, rot: Math.PI, accent: "#fbbf24" },
];

/** One dev desk with dual monitors + chair. */
const DevDesk = memo(function DevDesk({
  x,
  z,
  rot,
  accent,
}: {
  x: number;
  z: number;
  rot: number;
  accent: string;
}) {
  const slot = { position: [x, 0, z] as [number, number, number], rotationY: rot, zone: "rnd" };
  const chair = deskChairSlot(slot);
  return (
    <group>
      <Desk position={slot.position} rotationY={rot} />
      <Monitor position={deskLocalToWorld(slot.position, rot, [-0.45, 0, -0.35])} rotationY={rot} accent={accent} />
      <Monitor position={deskLocalToWorld(slot.position, rot, [0.45, 0, -0.35])} rotationY={rot} accent={accent} />
      <Chair position={chair.position} rotationY={chair.rotationY} />
    </group>
  );
});

export const RnDRoom = memo(function RnDRoom() {
  return (
    <group>
      {/* west partition: door gap z 8..10 into the garden hall */}
      <WallSegments axis="z" fixed={1} from={5} to={14} gaps={[[8, 10]]} />
      {/* north partition x 6..16 (the lounge owns z=5 west of x=6; no door) */}
      <WallSegments axis="x" fixed={5} from={6} to={16} />
      {/* east partition: door gap z 8..10 into the south-east lobby */}
      <WallSegments axis="z" fixed={16} from={5} to={14} gaps={[[8, 10]]} />
      <Door position={[1, 0, 9]} rotationY={Math.PI / 2} width={2} />
      <Door position={[16, 0, 9]} rotationY={Math.PI / 2} width={2} />
      <Signage text="RUANG R&D" position={[1.18, 2.35, 9]} rotationY={Math.PI / 2} scale={0.75} />

      {DEV_DESKS.map((d) => (
        <DevDesk key={`${d.x}:${d.z}`} x={d.x} z={d.z} rot={d.rot} accent={d.accent} />
      ))}

      {/* experiment board + parts shelf */}
      <Whiteboard position={[13, 0, 13.3]} rotationY={Math.PI} />
      <Shelf position={[13.5, 0, 6]} rotationY={Math.PI} />
      <mesh geometry={geoBox} material={matBoard} scale={[1.4, 0.5, 0.8]} position={[13.5, 1.35, 6]} />

      <Plant position={[1.8, 0, 13.2]} />
      <Plant position={[15.2, 0, 5.8]} scale={0.85} />
      <CeilingLamp position={[8, 10]} />
    </group>
  );
});
