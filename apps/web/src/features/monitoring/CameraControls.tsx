import { useAgentStore } from "../../stores/useAgentStore";
import { useCameraStore } from "../../stores/useCameraStore";
import { AGENT_SPAWN_POSITION } from "../../world/layout";

/** Floating camera controls over the 3D viewport. */
export function CameraControls() {
  const selectedId = useAgentStore((s) => s.selectedId);
  const agents = useAgentStore((s) => s.agents);
  const requestReset = useCameraStore((s) => s.requestReset);
  const requestFocus = useCameraStore((s) => s.requestFocus);

  const focusSelected = () => {
    if (!selectedId) return;
    const agent = agents[selectedId];
    if (!agent) return;
    const pos = AGENT_SPAWN_POSITION(agent.workstationId);
    requestFocus(agent.id, [pos[0], 1.2, pos[2]]);
  };

  return (
    <div className="camera-controls">
      <button
        type="button"
        className="btn"
        onClick={requestReset}
        aria-label="Reset camera view"
      >
        ⟲ Reset View
      </button>
      <button
        type="button"
        className="btn"
        onClick={focusSelected}
        disabled={!selectedId}
        aria-label="Focus camera on selected agent"
      >
        ◎ Focus Selected
      </button>
    </div>
  );
}
