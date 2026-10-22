import { Suspense, memo, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import { useAgentStore } from "../stores/useAgentStore";
import { STATUS_META } from "../utils/status";
import {
  AGENT_FACING,
  AGENT_SPAWN_POSITION,
  EXTRA_DESKS,
  deskChairSlot,
  deskLocalToWorld,
} from "./layout";
import { geoPlane } from "./geometries";
import { matFloor } from "./materials";
import { CameraRig } from "./camera/CameraRig";
import { AgentAvatar } from "./characters/AgentAvatar";
import { InstancedChairs } from "./furniture/Chair";
import { Desk } from "./furniture/Desk";
import { Monitor } from "./furniture/Monitor";
import { CeilingLamp } from "./furniture/CeilingLamp";
import { Wall } from "./furniture/Wall";
import { OpenWorkspace } from "./rooms/OpenWorkspace";
import { MeetingRoom } from "./rooms/MeetingRoom";
import { MissionControlRoom } from "./rooms/MissionControlRoom";
import { Lounge } from "./rooms/Lounge";

const LAMP_XS = [-16, -8, 0, 8, 16];
const LAMP_ZS = [-10, -2, 6, 12];

const ZONE_LABELS: Array<{ text: string; position: [number, number, number] }> = [
  { text: "OPEN WORKSPACE", position: [0, 3.0, 1] },
  { text: "MEETING ROOM", position: [-14, 3.0, -9.5] },
  { text: "MISSION CONTROL", position: [14, 3.0, -9.5] },
  { text: "LOUNGE", position: [8, 3.0, 10.5] },
];

function ZoneLabels() {
  return (
    <group>
      {ZONE_LABELS.map((z) => (
        <Billboard key={z.text} position={z.position}>
          <Text fontSize={0.5} color="#54658a" anchorX="center" anchorY="middle">
            {z.text}
          </Text>
        </Billboard>
      ))}
    </group>
  );
}

function Floor() {
  return (
    <group>
      <mesh
        geometry={geoPlane}
        material={matFloor}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[48, 40, 1]}
        receiveShadow
      />
      <gridHelper args={[40, 20, "#22314d", "#131c30"]} position={[0, 0.02, 0]} />
      {/* perimeter walls */}
      <Wall length={40} position={[0, 0, -14]} windows={6} />
      <Wall length={40} position={[0, 0, 14]} rotationY={Math.PI} windows={6} />
      <Wall length={28} position={[-20, 0, 0]} rotationY={Math.PI / 2} windows={4} />
      <Wall length={28} position={[20, 0, 0]} rotationY={-Math.PI / 2} windows={4} />
      {/* hanging lamps (emissive only — no real lights) */}
      {LAMP_XS.flatMap((x) =>
        LAMP_ZS.map((z) => <CeilingLamp key={`${x}:${z}`} position={[x, z]} />),
      )}
      <ZoneLabels />
    </group>
  );
}

/** Desks/chairs/monitors for the 22 stress-mode overflow slots. */
const OverflowDesks = memo(function OverflowDesks() {
  const entries = useMemo(() => Object.entries(EXTRA_DESKS), []);
  const chairSlots = useMemo(
    () => entries.map(([, slot]) => deskChairSlot(slot)),
    [entries],
  );
  return (
    <group>
      {entries.map(([id, slot]) => (
        <group key={id}>
          <Desk position={slot.position} rotationY={slot.rotationY} />
          <Monitor
            position={deskLocalToWorld(slot.position, slot.rotationY, [0, 0, -0.35])}
            rotationY={slot.rotationY}
            accent="#64748b"
          />
        </group>
      ))}
      <InstancedChairs slots={chairSlots} />
    </group>
  );
});

/** One avatar per agent, seated at its workstation. */
const AgentAvatars = memo(function AgentAvatars() {
  const agents = useAgentStore((s) => s.agents);
  const list = useMemo(() => Object.values(agents), [agents]);
  return (
    <group>
      {list.map((agent) => (
        <AgentAvatar
          key={agent.id}
          agent={agent}
          position={AGENT_SPAWN_POSITION(agent.workstationId)}
          rotationY={AGENT_FACING(agent.workstationId)}
          color={STATUS_META[agent.status].color}
        />
      ))}
    </group>
  );
});

/**
 * The 3D office. Exactly ONE shadow-casting light (the directional);
 * everything else is ambient/hemisphere fill or emissive decoration.
 */
export default function OfficeScene() {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [16, 13, 16], fov: 45 }}>
      <color attach="background" args={["#0b0f1a"]} />
      <fog attach="fog" args={["#0b0f1a", 48, 95]} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#3b4a6b", "#0b0f1a", 0.35]} />
      <directionalLight
        castShadow
        position={[12, 18, 8]}
        intensity={1.15}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
      <Floor />
      <Suspense fallback={null}>
        <OpenWorkspace />
        <MeetingRoom />
        <MissionControlRoom />
        <Lounge />
        <OverflowDesks />
        <AgentAvatars />
      </Suspense>
      <CameraRig />
    </Canvas>
  );
}
