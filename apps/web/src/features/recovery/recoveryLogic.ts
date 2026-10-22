/**
 * Recovery workflow logic: pure helpers plus the honest action hooks the
 * RecoveryDirector and the agent detail panel share.
 *
 * Honesty rules enforced here:
 * - `shouldAutoRecover` fires ONLY on status === 'error' — never for
 *   idle/waiting/offline/meeting/recovering. The workflow reacts to real
 *   agent statuses, never invents them.
 * - `simulateError` / `resolveError` are explicitly labeled SIMULATED demo
 *   hooks (they flip the local store only). The UI must label them as such.
 * - A bed is only assigned AFTER `movement.navigateToFloor` succeeds. If
 *   the path fails, the bed stays free and an event is logged.
 */
import type {
  ActivityEntry,
  ActivityKind,
  AgentInfo,
  AgentStatus,
  ErrorCategory,
} from "@virtual-ai-office/shared";
import {
  RECOVERY_BEDS,
  ROOM_BY_ID,
  type BedDef,
} from "../../world/building/floorPlan";
import type { FloorPoint } from "../../world/navigation";
import { movement } from "../../world/movement";
import { useAgentStore } from "../../stores/useAgentStore";
import { useOccupancyStore, workstationLocation } from "../../stores/useOccupancyStore";
import { usePresenceStore } from "../../stores/usePresenceStore";

/** Statuses the recovery workflow treats as healthy (error cleared). */
export const HEALTHY_STATUSES: AgentStatus[] = [
  "working",
  "idle",
  "thinking",
  "meeting",
  "waiting",
];

export function isHealthyStatus(status: AgentStatus): boolean {
  return HEALTHY_STATUSES.includes(status);
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** First bed with no occupant, or null when the recovery room is full. */
export function findFreeBed(
  beds: BedDef[],
  assignments: Record<string, string>,
): BedDef | null {
  return beds.find((b) => !(b.id in assignments)) ?? null;
}

export interface AutoRecoverInput {
  status: AgentStatus;
  enabled: boolean;
  autoRecover: boolean;
  hasBed: boolean;
  isMoving: boolean;
}

/**
 * Auto-recovery fires ONLY for agents whose live status is 'error'.
 * Never for idle/waiting/offline (nothing is wrong), never for
 * meeting/recovering (already handled), never while already walking, and
 * never for an agent that already holds a bed.
 */
export function shouldAutoRecover(input: AutoRecoverInput): boolean {
  return (
    input.enabled &&
    input.autoRecover &&
    input.status === "error" &&
    !input.hasBed &&
    !input.isMoving
  );
}

/** Floor-aware destination for a recovery bed (all beds are upstairs in Ruang Pemulihan). */
export function recoveryTarget(bed: BedDef): FloorPoint {
  const floor = ROOM_BY_ID[bed.roomId]?.floor ?? 0;
  return { x: bed.position[0], z: bed.position[2], floor };
}

/** Manual resolution is allowed from 'error' or 'recovering' only. */
export function canMarkResolved(status: AgentStatus): boolean {
  return status === "error" || status === "recovering";
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

let eventCounter = 0;

export function makeRecoveryEvent(
  agentId: string,
  message: string,
  kind: ActivityKind = "note",
): ActivityEntry {
  eventCounter += 1;
  return {
    id: `recovery-${Date.now()}-${eventCounter}`,
    agentId,
    timestamp: new Date().toISOString(),
    kind,
    message,
  };
}

export function appendRecoveryEvent(agentId: string, message: string): void {
  useAgentStore.getState().appendEvent(agentId, makeRecoveryEvent(agentId, message));
}

// ---------------------------------------------------------------------------
// Simulation hooks (explicitly labeled SIMULATED in the UI)
// ---------------------------------------------------------------------------

/**
 * SIMULATED: inject a synthetic error into the local agent store so the
 * recovery workflow can be exercised end-to-end without a real backend
 * failure. Demo/testing use only.
 */
export function simulateError(
  agentId: string,
  category: ErrorCategory = "unknown",
  message?: string,
): void {
  const store = useAgentStore.getState();
  const agent = store.agents[agentId];
  if (!agent) return;
  store.applyUpdate({
    ...agent,
    status: "error",
    lastSeen: new Date().toISOString(),
  });
  appendRecoveryEvent(
    agentId,
    `SIMULATED error injected [${category}]: ${message ?? "synthetic failure for recovery-workflow testing"}`,
  );
}

/**
 * SIMULATED: clear a synthetic error (marks the agent idle). The
 * RecoveryDirector then walks the agent back to its workstation.
 */
export function resolveError(agentId: string): void {
  const store = useAgentStore.getState();
  const agent = store.agents[agentId];
  if (!agent) return;
  store.applyUpdate({
    ...agent,
    status: "idle",
    lastSeen: new Date().toISOString(),
  });
  appendRecoveryEvent(agentId, "SIMULATED error cleared — agent marked idle");
}

// ---------------------------------------------------------------------------
// Workflow actions (shared by RecoveryDirector and the detail panel)
// ---------------------------------------------------------------------------

export type RecoveryActionResult =
  | { ok: true; bedId: string }
  | { ok: false; reason: string };

/**
 * Walk an agent to a free recovery bed. The bed is assigned ONLY after the
 * movement registry accepts the route; a failed route leaves the bed free.
 * On arrival the agent's status becomes 'recovering' (resting in bed).
 */
export function sendToRecovery(agentId: string): RecoveryActionResult {
  const agent: AgentInfo | undefined = useAgentStore.getState().agents[agentId];
  if (!agent) return { ok: false, reason: `Unknown agent "${agentId}"` };
  const occ = useOccupancyStore.getState();
  if (occ.bedOf(agentId)) {
    return { ok: false, reason: "Agent already holds a recovery bed" };
  }
  const bed = findFreeBed(RECOVERY_BEDS, occ.bedAssignment);
  if (!bed) return { ok: false, reason: "Recovery room is full" };

  const started = movement.navigateToFloor(agentId, recoveryTarget(bed), {
    arriveActivity: "seated",
    arrivePose: "free",
    onArrive: () => {
      usePresenceStore
        .getState()
        .setPresence(agentId, { activity: "seated", pose: "free" });
      const st = useAgentStore.getState();
      const current = st.agents[agentId];
      // Only the still-errored agent transitions; a resolved agent keeps
      // whatever healthy status it has.
      if (current && current.status === "error") {
        st.applyUpdate({ ...current, status: "recovering" });
        st.appendEvent(
          agentId,
          makeRecoveryEvent(agentId, "Arrived at recovery bed — now recovering"),
        );
      }
    },
  });
  if (!started) {
    return {
      ok: false,
      reason: "Recovery transit unavailable (agent not registered or no route)",
    };
  }

  occ.assignBed(agentId, bed.id);
  appendRecoveryEvent(agentId, `Moved to recovery (${bed.id})`);
  return { ok: true, bedId: bed.id };
}

/**
 * Manual resolution: flip the agent back to idle. The RecoveryDirector
 * picks up the healthy agent on the next tick and walks it back to its
 * workstation, releasing the bed. Labeled as a manual action in the UI.
 */
export function markResolved(agentId: string): void {
  const store = useAgentStore.getState();
  const agent = store.agents[agentId];
  if (!agent) return;
  const bedId = useOccupancyStore.getState().bedOf(agentId);
  store.applyUpdate({
    ...agent,
    status: "idle",
    lastSeen: new Date().toISOString(),
  });
  appendRecoveryEvent(
    agentId,
    `Error marked resolved (manual action)${bedId ? ` — returning from ${bedId}` : ""}`,
  );
}

/**
 * Walk a healthy bed-holder back to its workstation and release the bed.
 * Returns false when no route is available (bed stays assigned).
 */
export function returnToWorkstation(agentId: string): boolean {
  const agent = useAgentStore.getState().agents[agentId];
  if (!agent) return false;
  const occ = useOccupancyStore.getState();
  const wsId = occ.workstationOf(agentId, agent.workstationId);
  const loc = wsId ? workstationLocation(wsId) : null;
  if (!loc) return false;
  const started = movement.navigateToFloor(
    agentId,
    { x: loc.x, z: loc.z, floor: loc.floor },
    {
      arriveActivity: "seated",
      arrivePose: "desk",
      onArrive: () =>
        usePresenceStore
          .getState()
          .setPresence(agentId, { activity: "seated", pose: "desk" }),
    },
  );
  if (!started) return false;
  occ.releaseBed(agentId);
  appendRecoveryEvent(agentId, "Returned to workstation — recovery bed released");
  return true;
}
