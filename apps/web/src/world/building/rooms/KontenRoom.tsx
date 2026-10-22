/**
 * Ruang Konten (second floor, x -9..2, z -14..-4; authored at local y=0):
 * the content studio — creator desks (konten-01/02) with monitors, a camera
 * tripod + ring light in the shooting corner, and a content-calendar
 * whiteboard. (Replaces the old generic Studio room.)
 *
 * North edge is the building perimeter (shell wall); the west partition
 * (x=-9) is owned by the direksi room. The east partition (x=2) and the
 * south partition (z=-4, door gap x -4..-2 into the lounge) are owned by
 * this room.
 */
import { memo, useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { WORKSTATIONS } from "../floorPlan";
import { deskChairSlot, deskLocalToWorld, type DeskSlot } from "../../layout";
import { CeilingLamp } from "../../furniture/CeilingLamp";
import { Chair } from "../../furniture/Chair";
import { Desk } from "../../furniture/Desk";
import { Door } from "../../furniture/Door";
import { Monitor } from "../../furniture/Monitor";
import { Plant } from "../../furniture/Plant";
import { Signage } from "../../furniture/Signage";
import { Whiteboard } from "../../furniture/Whiteboard";
import { geoBox, geoCylinder, geoTorus } from "../../geometries";
import { localDeskSlot, WallSegments } from "./_helpers";

const matTripod = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.5, metalness: 0.5 });
const matRing = new THREE.MeshBasicMaterial({ color: "#fef3c7" });

/** One creator desk: desk + monitor + chair. */
const KontenDesk = memo(function KontenDesk({ slot }: { slot: DeskSlot }) {
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

/** Camera tripod + glowing ring light in the shooting corner. */
const ShootCorner = memo(function ShootCorner({ position }: { position: [number, number, number] }) {
  const [x, , z] = position;
  return (
    <group position={[x, 0, z]}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          geometry={geoCylinder}
          material={matTripod}
          scale={[0.06, 1.5, 0.06]}
          position={[Math.cos((i * 2 * Math.PI) / 3) * 0.35, 0.75, Math.sin((i * 2 * Math.PI) / 3) * 0.35]}
          rotation={[Math.sin((i * 2 * Math.PI) / 3) * 0.35, 0, -Math.cos((i * 2 * Math.PI) / 3) * 0.35]}
        />
      ))}
      <mesh geometry={geoBox} material={matTripod} scale={[0.35, 0.25, 0.2]} position={[0, 1.55, 0]} />
      <mesh geometry={geoTorus} material={matRing} scale={[1.1, 1.1, 1.1]} position={[1.3, 1.5, 0]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={geoCylinder} material={matTripod} scale={[0.06, 1.5, 0.06]} position={[1.3, 0.75, 0]} />
    </group>
  );
});

export const KontenRoom = memo(function KontenRoom() {
  const slots = useMemo(
    () => ["konten-01", "konten-02"].map((id) => localDeskSlot(WORKSTATIONS[id])),
    [],
  );
  return (
    <group>
      {/* east partition against the musola */}
      <WallSegments axis="z" fixed={2} from={-14} to={-4} />
      {/* south partition: door gap x -4..-2 into the lounge */}
      <WallSegments axis="x" fixed={-4} from={-9} to={2} gaps={[[-4, -2]]} />
      <Door position={[-3, 0, -4]} width={2} />
      <Signage text="RUANG KONTEN" position={[-3, 2.35, -3.82]} scale={0.75} />

      {slots.map((slot, i) => (
        <KontenDesk key={i} slot={slot} />
      ))}

      {/* shooting corner */}
      <ShootCorner position={[-7.5, 0, -5.8]} />
      <Text position={[-6.2, 2.6, -5.8]} fontSize={0.22} color="#f9a8d4" anchorX="center" anchorY="middle">
        STUDIO MINI
      </Text>

      <Whiteboard position={[1.2, 0, -13.3]} rotationY={0} />
      <Plant position={[-8.2, 0, -13.2]} scale={0.9} />
      <Plant position={[1.2, 0, -4.8]} scale={0.85} />
      <CeilingLamp position={[-3, -9]} />
    </group>
  );
});
