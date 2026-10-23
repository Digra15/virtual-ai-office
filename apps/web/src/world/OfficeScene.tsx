import { Suspense, memo, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAgentStore } from "../stores/useAgentStore";
import { useOfficeConfigStore } from "../stores/useOfficeConfigStore";
import { useSceneReadyStore } from "../stores/useSceneReadyStore";
import { STATUS_META } from "../utils/status";
import { CameraRig } from "./camera/CameraRig";
import { AgentAvatar } from "./characters/AgentAvatar";
import { MovementController } from "./MovementController";
import { Building } from "./building/Building";
import { DayNightRig } from "./DayNightRig";

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
 * One-shot first-frame marker: flips the honest loading overlay off only
 * after the Canvas has actually rendered a real frame — never on JS
 * module load.
 */
const FirstFrameSignal = memo(function FirstFrameSignal() {
  const fired = useRef(false);
  useFrame(() => {
    if (!fired.current) {
      fired.current = true;
      useSceneReadyStore.getState().markReady();
    }
  });
  return null;
});

/**
 * The 3D office: two-story building + exterior, composed by <Building />.
 * Lighting (day/night) lives in <DayNightRig /> — exactly ONE
 * shadow-casting light (the directional); everything else is
 * ambient/hemisphere fill or emissive decoration.
 *
 * Initial camera matches the Track-1 "office" preset ([18,13,22]) so the
 * CameraRig's mount glide starts from the right viewpoint.
 */
export default function OfficeScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [18, 13, 22], fov: 45 }}
      onCreated={() => useSceneReadyStore.getState().reset()}
    >
      <DayNightRig />
      <FirstFrameSignal />
      <Suspense fallback={null}>
        <Building />
        <AgentAvatars />
      </Suspense>
      <CameraRig />
      <MovementController />
    </Canvas>
  );
}
