/**
 * Occupancy tracking for the Virtual AI Office.
 *
 * The store keeps ONLY overrides — the source of truth for an agent's
 * default workstation stays on `AgentInfo.workstationId`:
 *   effectiveWorkstation(agent) = override[agent.id] ?? agent.workstationId
 *
 * Beds are different: nothing in `AgentInfo` names a recovery bed, so the
 * store is the single owner of `bedAssignment` (bedId -> agentId).
 *
 * Guards are pure functions (exported, unit-tested); the zustand store
 * wraps them with the live agent roster for conflict checks.
 */
import { create } from "zustand";
import {
  RECOVERY_BEDS,
  ROOM_BY_ID,
  WORKSTATIONS,
  roomAt,
  type RoomDef,
} from "../world/building/floorPlan";
import { DESKS, EXTRA_DESKS } from "../world/layout";
import { useAgentStore } from "./useAgentStore";

export type AssignResult = { ok: true } | { ok: false; reason: string };

export const ok = (): AssignResult => ({ ok: true });
export const fail = (reason: string): AssignResult => ({ ok: false, reason });

// ---------------------------------------------------------------------------
// Pure guards
// ---------------------------------------------------------------------------

/**
 * Can `requesterId` claim `wsId`? `occupiedBy` maps agentId -> workstationId
 * (effective assignments, including overrides). Re-claiming your own desk
 * is fine; `force` bypasses the occupancy check (admin override).
 */
export function checkWorkstationAvailable(
  wsId: string,
  occupiedBy: Record<string, string>,
  requesterId: string,
  force = false,
): AssignResult {
  const occupant = Object.entries(occupiedBy).find(
    ([id, ws]) => ws === wsId && id !== requesterId,
  )?.[0];
  if (occupant && !force) {
    return fail(`Workstation ${wsId} is occupied by agent "${occupant}"`);
  }
  return ok();
}

/** Can `requesterId` claim `bedId`? One agent per bed, no force override. */
export function checkBedAvailable(
  bedId: string,
  bedAssignment: Record<string, string>,
  requesterId: string,
): AssignResult {
  const occupant = bedAssignment[bedId];
  if (occupant && occupant !== requesterId) {
    return fail(`Bed ${bedId} is occupied by agent "${occupant}"`);
  }
  return ok();
}

// ---------------------------------------------------------------------------
// Workstation -> room resolution (pure)
// ---------------------------------------------------------------------------

export interface WorkstationLocation {
  floor: 0 | 1;
  x: number;
  z: number;
  roomId?: string;
}

/**
 * Resolve any known workstation id to its floor/position. Covers the
 * floorPlan WORKSTATIONS (pm-01, lab-*, …) plus the legacy layout DESKS
 * (ws-01..ws-08) and EXTRA_DESKS (stress-01..22).
 */
export function workstationLocation(wsId: string): WorkstationLocation | null {
  const extra = WORKSTATIONS[wsId];
  if (extra) {
    return {
      floor: extra.floor,
      x: extra.position[0],
      z: extra.position[2],
      roomId: extra.roomId,
    };
  }
  const desk = DESKS[wsId] ?? EXTRA_DESKS[wsId];
  if (desk) {
    return { floor: 0, x: desk.position[0], z: desk.position[2] };
  }
  return null;
}

/** RoomDef containing the workstation, or null when unknown. */
export function roomOfWorkstation(wsId: string): RoomDef | null {
  const loc = workstationLocation(wsId);
  if (!loc) return null;
  if (loc.roomId) return ROOM_BY_ID[loc.roomId] ?? null;
  return roomAt(loc.x, loc.z, loc.floor);
}

/** Is `bedId` one of the scene's recovery beds? */
export function isKnownBed(bedId: string): boolean {
  return RECOVERY_BEDS.some((b) => b.id === bedId);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface OccupancyState {
  /** agentId -> workstationId (only non-default assignments live here). */
  workstationOverride: Record<string, string>;
  /** bedId -> agentId. */
  bedAssignment: Record<string, string>;
  assignWorkstation: (
    agentId: string,
    wsId: string,
    opts?: { force?: boolean },
  ) => AssignResult;
  assignBed: (agentId: string, bedId: string) => AssignResult;
  releaseBed: (agentId: string) => void;
  bedOf: (agentId: string) => string | null;
  freeBeds: () => string[];
  /**
   * Effective workstation: override ?? the agent's own workstationId
   * (pass it as `fallback`) ?? null.
   */
  workstationOf: (agentId: string, fallback?: string) => string | null;
  /** RoomDef of the agent's effective workstation (null when unknown). */
  roomOf: (agentId: string, fallback?: string) => RoomDef | null;
  /** Test helper: clear all overrides and bed assignments. */
  reset: () => void;
}

/** Effective workstation per agent from the live roster + overrides. */
function effectiveAssignments(overrides: Record<string, string>): Record<string, string> {
  const agents = useAgentStore.getState().agents;
  const out: Record<string, string> = {};
  for (const a of Object.values(agents)) {
    out[a.id] = overrides[a.id] ?? a.workstationId;
  }
  return out;
}

export const useOccupancyStore = create<OccupancyState>()((set, get) => ({
  workstationOverride: {},
  bedAssignment: {},

  assignWorkstation: (agentId, wsId, opts) => {
    const result = checkWorkstationAvailable(
      wsId,
      effectiveAssignments(get().workstationOverride),
      agentId,
      opts?.force ?? false,
    );
    if (!result.ok) return result;
    set((s) => ({
      workstationOverride: { ...s.workstationOverride, [agentId]: wsId },
    }));
    return ok();
  },

  assignBed: (agentId, bedId) => {
    if (!isKnownBed(bedId)) {
      return fail(`Unknown recovery bed "${bedId}"`);
    }
    const result = checkBedAvailable(bedId, get().bedAssignment, agentId);
    if (!result.ok) return result;
    set((s) => {
      // One bed per agent: release any bed this agent already holds.
      const bedAssignment: Record<string, string> = {};
      for (const [b, occupant] of Object.entries(s.bedAssignment)) {
        if (occupant !== agentId) bedAssignment[b] = occupant;
      }
      bedAssignment[bedId] = agentId;
      return { bedAssignment };
    });
    return ok();
  },

  releaseBed: (agentId) =>
    set((s) => {
      const bedAssignment: Record<string, string> = {};
      for (const [b, occupant] of Object.entries(s.bedAssignment)) {
        if (occupant !== agentId) bedAssignment[b] = occupant;
      }
      return { bedAssignment };
    }),

  bedOf: (agentId) => {
    const found = Object.entries(get().bedAssignment).find(
      ([, occupant]) => occupant === agentId,
    );
    return found ? found[0] : null;
  },

  freeBeds: () =>
    RECOVERY_BEDS.filter((b) => !(b.id in get().bedAssignment)).map((b) => b.id),

  workstationOf: (agentId, fallback) =>
    get().workstationOverride[agentId] ?? fallback ?? null,

  roomOf: (agentId, fallback) => {
    const ws = get().workstationOf(agentId, fallback);
    return ws ? roomOfWorkstation(ws) : null;
  },

  reset: () => set({ workstationOverride: {}, bedAssignment: {} }),
}));
