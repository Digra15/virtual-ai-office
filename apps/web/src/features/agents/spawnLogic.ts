/**
 * Workstation id allocation for the spawn panel (pure, testable).
 *
 * There are no hot desks anymore (the user's own office code has only
 * the 8 workstations ws-01..ws-08), so spawned agents get a virtual
 * workstation id. It is unique per agent id and resolves through the
 * deterministic lobby-grid fallback in
 * world/layout.ts `AGENT_SPAWN_POSITION`, so no two agents stack.
 */
export function nextSpawnWorkstationId(agentId: string): string {
  return `spawn-${agentId}`;
}
