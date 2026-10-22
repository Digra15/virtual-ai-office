/**
 * Training Room (second floor, x -20..-6, z 7..14; authored at local y=0):
 * four learner desks (train-01..04) facing a wall display screen plus a
 * whiteboard.
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
import { Whiteboard } from "../../furniture/Whiteboard";
import { geoBox, geoPlane } from "../../geometries";
import { Door } from "../../furniture/Door";
import { Signage } from "../../furniture/Signage";
import { matPanelDark } from "./_fallback";
import { WallSegments, localDeskSlot } from "./_helpers";

const TRAIN_IDS = ["train-01", "train-02", "train-03", "train-04"] as const;

/** One learner desk: desk + monitor + chair. */
const LearnerDesk = memo(function LearnerDesk({ slot }: { slot: DeskSlot }) {
  const chair = useMemo(() => deskChairSlot(slot), [slot]);
  return (
    <group>
      <Desk position={slot.position} rotationY={slot.rotationY} />
      <Monitor
        position={deskLocalToWorld(slot.position, slot.rotationY, [0, 0, -0.35])}
        rotationY={slot.rotationY}
        accent="#38bdf8"
      />
      <Chair position={chair.position} rotationY={chair.rotationY} />
    </group>
  );
});

/** Onboarding display on the north wall. */
const OnboardingScreen = memo(function OnboardingScreen() {
  return (
    <group position={[-14, 0, 7.15]}>
      <mesh geometry={geoBox} material={matPanelDark} scale={[4.6, 2.3, 0.12]} position={[0, 2.0, 0]} />
      <mesh geometry={geoPlane} position={[0, 2.0, 0.07]} scale={[4.3, 2.0, 1]}>
        <meshBasicMaterial color="#0c2a4a" />
      </mesh>
      <Text position={[0, 2.3, 0.09]} fontSize={0.36} color="#7dd3fc" anchorX="center" anchorY="middle">
        ONBOARDING
      </Text>
      <Text position={[0, 1.7, 0.09]} fontSize={0.2} color="#bae6fd" anchorX="center" anchorY="middle">
        welcome aboard — day one
      </Text>
    </group>
  );
});

export const Training = memo(function Training() {
  const slots = useMemo(
    () => TRAIN_IDS.map((id) => localDeskSlot(WORKSTATIONS[id])),
    [],
  );
  return (
    <group>
      {/* north wall with the door gap (x -14..-12); east wall */}
      <WallSegments axis="x" fixed={7} from={-20} to={-6} gaps={[[-14, -12]]} />
      <WallSegments axis="z" fixed={-6} from={7} to={14} />
      <Door position={[-13, 0, 7]} width={2} />
      {slots.map((slot, i) => (
        <LearnerDesk key={TRAIN_IDS[i]} slot={slot} />
      ))}
      <OnboardingScreen />
      <Whiteboard position={[-9, 0, 7.15]} rotationY={0} />
      <Signage text="TRAINING" position={[-18, 2.3, 7.15]} scale={0.85} />
      <Plant position={[-6.7, 0, 13.3]} />
      <CeilingLamp position={[-14, 10.5]} />
    </group>
  );
});
