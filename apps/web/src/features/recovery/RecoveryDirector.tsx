/**
 * RecoveryDirector — headless recovery-workflow controller.
 *
 * Mounted once in App (see App.tsx). Subscribes to the agent store AND the
 * presence store (avatar registration reports through presence, so a
 * re-check on registration catches agents whose first attempt ran before
 * the 3D scene mounted).
 *
 * Behavior:
 * - status === 'error', no bed, auto-recover on, not already walking
 *   → walk to a free bed, assign it, flip to 'recovering' on arrival.
 *   No free bed → one "recovery full" event. No route → one
 *   "recovery transit unavailable" event and NO bed assignment.
 * - healthy status (working/idle/thinking/meeting/waiting) + holds a bed
 *   → walk back to the workstation, release the bed, log the return.
 * - 'recovering' agents HOLD their bed until resolved — the director never
 *   moves a resting agent (returning it immediately would thrash).
 *
 * The director only ever reacts to real `agent.status` values; it never
 * invents errors. Per-agent notification dedupe keeps the event log quiet.
 */
import { useEffect } from "react";
import type { AgentInfo } from "@virtual-ai-office/shared";
import { RECOVERY_BEDS } from "../../world/building/floorPlan";
import { movement } from "../../world/movement";
import { useAgentStore } from "../../stores/useAgentStore";
import { useOccupancyStore } from "../../stores/useOccupancyStore";
import { usePresenceStore } from "../../stores/usePresenceStore";
import { getEffectiveRecoveryConfig } from "./useRecoveryConfigStore";
import {
  appendRecoveryEvent,
  findFreeBed,
  isHealthyStatus,
  returnToWorkstation,
  sendToRecovery,
  shouldAutoRecover,
} from "./recoveryLogic";

// Last notification key per agent — prevents event-log spam when the
// director re-runs on every store change.
const notified = new Map<string, string>();

function noteOnce(agentId: string, key: string, message: string): void {
  if (notified.get(agentId) === key) return;
  notified.set(agentId, key);
  appendRecoveryEvent(agentId, message);
}

function clearNotes(agentId: string): void {
  notified.delete(agentId);
}

function processAgents(agents: Record<string, AgentInfo>): void {
  const { enabled, autoRecover } = getEffectiveRecoveryConfig();
  const occ = useOccupancyStore.getState();

  for (const agent of Object.values(agents)) {
    const bedId = occ.bedOf(agent.id);

    // 1. Auto-recover errored agents (only on a real 'error' status).
    if (
      shouldAutoRecover({
        status: agent.status,
        enabled,
        autoRecover,
        hasBed: bedId !== null,
        isMoving: movement.isMoving(agent.id),
      })
    ) {
      const bed = findFreeBed(RECOVERY_BEDS, occ.bedAssignment);
      if (!bed) {
        noteOnce(
          agent.id,
          "full",
          "Recovery room full — errored agent waiting for a free bed",
        );
        continue;
      }
      const res = sendToRecovery(agent.id);
      if (!res.ok) {
        noteOnce(agent.id, "transit", `Recovery transit unavailable: ${res.reason}`);
      } else {
        clearNotes(agent.id);
      }
      continue;
    }

    // 2. Healthy again while holding a bed → walk back, release the bed.
    if (bedId !== null && isHealthyStatus(agent.status)) {
      if (movement.isMoving(agent.id)) continue;
      if (returnToWorkstation(agent.id)) {
        clearNotes(agent.id);
      } else {
        noteOnce(
          agent.id,
          "return-fail",
          "Recovery transit unavailable — could not return to workstation",
        );
      }
      continue;
    }

    // 3. 'recovering' agents rest in bed until resolved — never moved.
    if (agent.status !== "error") clearNotes(agent.id);
  }
}

/**
 * Headless controller. Renders nothing. NOTE: the parent must mount this
 * exactly once, e.g. `<RecoveryDirector />` inside App.tsx next to the
 * other directors (WanderDirector).
 */
export function RecoveryDirector(): null {
  useEffect(() => {
    // Run once on mount for the current snapshot…
    processAgents(useAgentStore.getState().agents);
    // …then on every agent change…
    const unsubAgents = useAgentStore.subscribe((s) => processAgents(s.agents));
    // …and on presence changes (avatar registration reports "seated"
    // through presence, so a first attempt that ran before the 3D scene
    // mounted gets retried once avatars exist).
    const unsubPresence = usePresenceStore.subscribe(() =>
      processAgents(useAgentStore.getState().agents),
    );
    return () => {
      unsubAgents();
      unsubPresence();
    };
  }, []);
  return null;
}

/** Test hook: clear per-agent notification dedupe between tests. */
export function _resetRecoveryDirectorForTests(): void {
  notified.clear();
}
