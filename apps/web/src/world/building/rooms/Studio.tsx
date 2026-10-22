/**
 * Content Studio (second floor, x 6..20, z -14..-7; authored at local y=0):
 * two creative desks (studio-01/02) with monitors, a camera on a tripod and
 * a backdrop panel.
 */
import { memo, useMemo } from "react";
import * as THREE from "three";
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
import { geoBox, geoCylinder } from "../../geometries";
import { Door } from "../../furniture/Door";
import { Signage } from "../../furniture/Signage";
import { matPanelDark } from "./_fallback";
import { WallSegments, localDeskSlot } from "./_helpers";

type V3 = [number, number, number];

const matBackdrop = new THREE.MeshStandardMaterial({ color: "#0f766e", roughness: 0.9 });

/** Camera on a tripod (3 legs + column + body + lens). */
const TripodCamera = memo(function TripodCamera({
  position,
  rotationY = 0,
}: {
  position: V3;
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh
            key={i}
            geometry={geoCylinder}
            material={matPanelDark}
            scale={[0.07, 1.6, 0.07]}
            position={[Math.cos(a) * 0.35, 0.75, Math.sin(a) * 0.35]}
            rotation={[Math.sin(a) * 0.42, 0, -Math.cos(a) * 0.42]}
          />
        );
      })}
      <mesh geometry={geoCylinder} material={matPanelDark} scale={[0.09, 0.5, 0.09]} position={[0, 1.6, 0]} />
      <mesh geometry={geoBox} material={matPanelDark} scale={[0.5, 0.32, 0.35]} position={[0, 1.95, 0]} castShadow />
      <mesh
        geometry={geoCylinder}
        material={matPanelDark}
        scale={[0.22, 0.3, 0.22]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 1.95, -0.3]}
      />
      {/* recording tally light */}
      <mesh geometry={geoCylinder} scale={[0.1, 0.03, 0.1]} position={[0, 2.12, -0.05]}>
        <meshBasicMaterial color="#ef4444" />
      </mesh>
    </group>
  );
});

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
      {/* south wall toward the north corridor (door gap x 12..14); west wall */}
      <WallSegments axis="x" fixed={-7} from={6} to={20} gaps={[[12, 14]]} />
      <WallSegments axis="z" fixed={6} from={-14} to={-7} />
      <Door position={[13, 0, -7]} width={2} />
      {slots.map((slot, i) => (
        <StudioDesk key={i} slot={slot} />
      ))}
      {/* shoot corner: backdrop + tripod camera facing it */}
      <mesh geometry={geoBox} material={matBackdrop} scale={[3.2, 2.4, 0.12]} position={[17, 1.4, -12.5]} castShadow />
      {[-1.3, 1.3].map((dx) => (
        <mesh
          key={dx}
          geometry={geoCylinder}
          material={matPanelDark}
          scale={[0.08, 2.6, 0.08]}
          position={[17 + dx, 1.3, -12.5]}
        />
      ))}
      <TripodCamera position={[17, 0, -9]} rotationY={Math.PI} />
      <Signage text="CONTENT STUDIO" position={[13, 2.3, -7.15]} rotationY={Math.PI} scale={0.75} />
      <Plant position={[6.7, 0, -7.6]} />
      <CeilingLamp position={[12, -10.5]} />
    </group>
  );
});
