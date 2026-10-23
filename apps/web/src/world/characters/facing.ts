/**
 * Facing + prayer-state glue for the 2.5D directional character system.
 *
 * FACING CONVENTION (read carefully — this is the source of the old
 * "always stares at the camera" confusion):
 * - The movement registry (`world/movement.ts`) owns each avatar's outer
 *   group rotation.y. While walking it equals the direction of travel;
 *   while seated it equals the DESK's rotation (see `AGENT_FACING`).
 * - But a seated character's NOSE points at the monitor, which sits at
 *   desk-local −z — i.e. PI away from the desk rotation. The renderer
 *   therefore uses a *visual facing* = group rotation + PI whenever the
 *   agent's pose is "desk" (seated at its own desk), and the raw group
 *   rotation otherwise (walking / standing / meeting, where the registry
 *   already stores the nose direction, e.g. `arriveFacing` toward the
 *   meeting table center).
 * - This keeps every existing `arriveFacing` call site (wander
 *   return-home, meeting end, recovery return) correct WITHOUT changes:
 *   they all pass the desk rotation, and the +PI lives in one place —
 *   the character renderer.
 *
 * PRAYER TRIGGER: an agent prays when its physical position is inside the
 * musola (room id "musola"), regardless of how it got there (wander,
 * meeting, manual move). Position-based, read from the movement registry.
 */
import { movement } from "../movement";
import { AGENT_FACING } from "../layout";
import { WORKSTATIONS, roomAt } from "../building/floorPlan";
import { wrapAngle } from "./characterTypes";

/** Room id of the musola (contract with the building layout). */
export const MUSOLA_ROOM_ID = "musola";

/**
 * Qibla facing: the mihrab is on the musola's east wall, so a praying
 * agent's nose points +X (east). World-space Y rotation (THREE convention).
 */
export const QIBLA_FACING = Math.PI / 2;

/**
 * Nose direction (world-space Y rotation, THREE convention) of an agent
 * seated at `workstationId`: the desk rotation turned PI so the character
 * faces desk-local −z (the monitor). Covers the floorPlan WORKSTATIONS
 * (ws-01..ws-08, all rotationY 0 → nose PI) and the legacy layout DESKS.
 */
export function deskFacing(workstationId: string): number {
  const ws = WORKSTATIONS[workstationId];
  const deskRot = ws ? ws.rotationY : AGENT_FACING(workstationId);
  return wrapAngle(deskRot + Math.PI);
}

/**
 * Room id at a world position, or null when outside every room.
 * The building is single-floor, so this always resolves on floor 0
 * (the `y` parameter is kept for signature compatibility).
 */
export function roomIdAtPosition(
  x: number,
  _y: number,
  z: number,
): string | null {
  return roomAt(x, z, 0)?.id ?? null;
}

/** Room id of an agent's current physical position (null when unknown). */
export function agentRoomId(agentId: string): string | null {
  const pos = movement.getPosition3D(agentId);
  if (!pos) return null;
  return roomIdAtPosition(pos.x, pos.y, pos.z);
}

/** True when the agent is physically inside the musola right now. */
export function isInMusola(agentId: string): boolean {
  return agentRoomId(agentId) === MUSOLA_ROOM_ID;
}
