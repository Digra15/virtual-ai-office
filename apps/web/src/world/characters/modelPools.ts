import type { AgentGender } from "@virtual-ai-office/shared";

/**
 * Gender pools for the CUTES 3D models (bundle "CUTES Part One" by
 * J-Toastie, CC-BY). A new agent WITHOUT a per-id model mapping gets a
 * model from its gender's pool, picked deterministically from its id —
 * the same agent looks the same on every reload, but different agents
 * get different models instead of everyone sharing the nika fallback.
 *
 * Classification evidence (the bundle itself carries no gender metadata:
 * all 8 GLBs share identical node names and a byte-identical baked skin
 * texture, so nothing in the files distinguishes them):
 * - Bundle names are explicit for Generic Female / Generic Male, and
 *   "Crypto Bro" is male-coded by name.
 * - The other five follow the project's own user-accepted gender
 *   reading: the prayer-wear assignments (user correction 2026-10-22,
 *   accepted 2026-10-25) combined with the per-id model mapping —
 *   Citizen 3 (writing) and Citizen 2 (design) wear mukena, while
 *   Citizen 1 (data), Retail Worker (automation) and Prisoner
 *   (monitoring) wear sarung+peci.
 * No model is left unclassified, so no pool has an ambiguity gap; if
 * the user disagrees with one Citizen/role model's placement, it is a
 * one-line move between the two arrays below.
 */
export const CUTES_GENDER_POOLS: Record<AgentGender, string[]> = {
  female: [
    "/models/cutes/Generic Female.glb",
    "/models/cutes/Citizen 2.glb",
    "/models/cutes/Citizen 3.glb",
  ],
  male: [
    "/models/cutes/Generic Male.glb",
    "/models/cutes/Citizen 1.glb",
    "/models/cutes/Crypto Bro.glb",
    "/models/cutes/Retail Worker.glb",
    "/models/cutes/Prisoner.glb",
  ],
};

/** FNV-1a hash (same construction as characterPresets.ts): stable across
 * reloads, so a picked model never changes for the same agent id. */
export function hashAgentId(agentId: string): number {
  let h = 2166136261;
  for (let i = 0; i < agentId.length; i++) {
    h ^= agentId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pool pick: same id → same model, different ids spread. */
export function pickGenderModel(
  gender: AgentGender,
  agentId: string,
): string {
  const pool = CUTES_GENDER_POOLS[gender];
  return pool[hashAgentId(agentId) % pool.length];
}

/**
 * Full model resolution, in precedence order:
 * (a) a per-id mapping wins unchanged (Difia/Kirana/Reno and the demo
 *     agents keep exactly their current models);
 * (b) a known gender picks deterministically from that gender's pool;
 * (c) unknown gender keeps the legacy fallback (nika / Generic Female).
 * `specificMap` is CUTES_MODEL from CutesAvatar.tsx, passed in so this
 * module stays free of three/drei imports and unit-testable in node.
 */
export function resolveCutesModel(
  agentId: string,
  gender: AgentGender | undefined,
  specificMap: Record<string, string>,
): string {
  const specific = specificMap[agentId];
  if (specific) return specific;
  if (gender) return pickGenderModel(gender, agentId);
  return specificMap.nika;
}
