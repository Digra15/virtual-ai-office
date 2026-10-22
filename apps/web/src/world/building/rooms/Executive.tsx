/**
 * Executive Office (second floor, x -20..-8, z -14..-7; authored at local
 * y=0): exec desk (exec-01), strategy display wall with goals/analytics,
 * rug, plant.
 */
import { memo, useMemo } from "react";
import { Text } from "@react-three/drei";
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
import { Rug } from "../../furniture/Rug";
import { geoBox, geoPlane } from "../../geometries";
import { Door } from "../../furniture/Door";
import { Signage } from "../../furniture/Signage";
import { matPanelDark } from "./_fallback";
import { WallSegments, localDeskSlot } from "./_helpers";

/** Strategy display wall (static goals/analytics text). */
const StrategyWall = memo(function StrategyWall() {
  return (
    <group position={[-14, 0, -13.85]}>
      <mesh geometry={geoBox} material={matPanelDark} scale={[6, 2.6, 0.12]} position={[0, 2.0, 0]} />
      <mesh geometry={geoPlane} position={[0, 2.0, 0.07]} scale={[5.7, 2.3, 1]}>
        <meshBasicMaterial color="#101d33" />
      </mesh>
      <Text position={[0, 2.8, 0.09]} fontSize={0.32} color="#fbbf24" anchorX="center" anchorY="middle">
        FY26 STRATEGY
      </Text>
      <Text
        position={[0, 2.1, 0.09]}
        fontSize={0.24}
        color="#e2e8f0"
        anchorX="center"
        anchorY="middle"
        maxWidth={5.2}
        textAlign="center"
      >
        {"Ship office v2  •  +40% engagement\nHire 4 agents  •  Zero downtime"}
      </Text>
      <Text position={[0, 1.35, 0.09]} fontSize={0.22} color="#4ade80" anchorX="center" anchorY="middle">
        ANALYTICS  +12% WoW
      </Text>
    </group>
  );
});

export const Executive = memo(function Executive() {
  const ws = WORKSTATIONS["exec-01"];
  // Authored at local y=0 — the Building composer offsets the floor group.
  const local: DeskSlot = useMemo(() => localDeskSlot(ws), [ws]);
  const chair = useMemo(() => deskChairSlot(local), [local]);
  return (
    <group>
      {/* south wall toward the north corridor (door gap x -15..-13) + east wall */}
      <WallSegments axis="x" fixed={-7} from={-20} to={-8} gaps={[[-15, -13]]} />
      <WallSegments axis="z" fixed={-8} from={-14} to={-7} />
      <Door position={[-14, 0, -7]} width={2} />
      <Desk position={local.position} rotationY={local.rotationY} />
      <Monitor
        position={deskLocalToWorld(local.position, local.rotationY, [0, 0, -0.35])}
        rotationY={local.rotationY}
        accent="#fbbf24"
      />
      <Chair position={chair.position} rotationY={chair.rotationY} />
      <StrategyWall />
      <Rug position={[-14, 0, -9.5]} radius={2.8} />
      <Signage text="EXECUTIVE" position={[-8.15, 2.3, -10.5]} rotationY={-Math.PI / 2} />
      <Plant position={[-18.5, 0, -7.8]} scale={1.2} />
      <CeilingLamp position={[-14, -10.5]} />
    </group>
  );
});
