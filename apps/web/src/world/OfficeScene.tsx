import { Suspense, memo, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { useAgentStore } from "../stores/useAgentStore";
import { useOfficeConfigStore } from "../stores/useOfficeConfigStore";
import { STATUS_META } from "../utils/status";
import { CameraRig } from "./camera/CameraRig";
import { AgentAvatar } from "./characters/AgentAvatar";
import { MovementController } from "./MovementController";
import { Building } from "./building/Building";

/** One avatar per agent. Position/rotation are owned by the movement
 *  system (registered on mount); this just maps the roster. */
const AgentAvatars = memo(function AgentAvatars() {
  const agents = useAgentStore((s) => s.agents);
  // Hide agents whose worker record is non-public (empty when unconfigured).
  const hiddenWorkerIds = useOfficeConfigStore((s) => s.hiddenWorkerIds);
  const list = useMemo(
    () =>
      Object.values(agents).filter((a) => !hiddenWorkerIds.includes(a.id)),
    [agents, hiddenWorkerIds],
  );
  return (
    <group>
      {list.map((agent) => (
        <AgentAvatar
          key={agent.id}
          agent={agent}
          color={STATUS_META[agent.status].color}
        />
      ))}
    </group>
  );
});

/**
 * The 3D office: two-story building + exterior, composed by <Building />.
 * Exactly ONE shadow-casting light (the directional); everything else is
 * ambient/hemisphere fill or emissive decoration.
 *
 * Initial camera matches the "entire building" cutaway preset so the
 * CameraRig's mount glide starts from the right viewpoint.
 */
export default function OfficeScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [30, 19, 36], fov: 45 }}
    >
      <color attach="background" args={["#0b0f1a"]} />
      <fog attach="fog" args={["#0b0f1a", 70, 170]} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#3b4a6b", "#0b0f1a", 0.35]} />
      <directionalLight
        castShadow
        position={[14, 22, 10]}
        intensity={1.15}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
      <Suspense fallback={null}>
        <Building />
        <AgentAvatars />
      </Suspense>
      <CameraRig />
      <MovementController />
    </Canvas>
  );
}
