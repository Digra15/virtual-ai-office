import type { ThreeEvent } from "@react-three/fiber";
import { useAgentStore } from "../../stores/useAgentStore";
import { useCameraStore } from "../../stores/useCameraStore";
import { AGENT_SPAWN_POSITION } from "../layout";

/**
 * Single code path for selecting an agent from the 3D scene.
 *
 * `select()` drives the detail panel (via `selectedId`), and the focus
 * request glides the camera to the agent's desk — the same pairing the
 * "Focus Selected" dashboard button performs.
 */
export function selectAgentFromScene(
  agentId: string,
  workstationId: string,
): void {
  useAgentStore.getState().select(agentId);
  const pos = AGENT_SPAWN_POSITION(workstationId);
  useCameraStore.getState().requestFocus(agentId, [pos[0], 1.2, pos[2]]);
}

/** Builds an `onClick` handler that selects an agent from the 3D scene. */
export function makeAgentClickHandler(agentId: string, workstationId: string) {
  return (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    selectAgentFromScene(agentId, workstationId);
  };
}

/** Pointer cursor affordance for clickable 3D objects. */
export function agentCursorHandlers() {
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>): void => {
      e.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    onPointerOut: (): void => {
      document.body.style.cursor = "";
    },
  };
}
