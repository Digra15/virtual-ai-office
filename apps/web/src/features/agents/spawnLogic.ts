import type { AgentInfo } from "@virtual-ai-office/shared";
import { EXTRA_DESKS } from "../../world/layout";

/**
 * Workstation allocation for the spawn panel (pure, testable).
 *
 * Returns the first free overflow desk, or null when every desk is taken.
 */
export function findFreeWorkstation(
  agents: Record<string, AgentInfo>,
): string | null {
  const occupied = new Set(Object.values(agents).map((a) => a.workstationId));
  return Object.keys(EXTRA_DESKS).find((ws) => !occupied.has(ws)) ?? null;
}
