import { describe, expect, it } from "vitest";
import { AGENT_STATUSES } from "@virtual-ai-office/shared";
import type { AgentStatus } from "@virtual-ai-office/shared";
import { STATUS_META } from "./status";

// AGENT_STATUSES may be exported as an array or a record — handle both.
const STATUSES: AgentStatus[] = (
  Array.isArray(AGENT_STATUSES) ? AGENT_STATUSES : Object.keys(AGENT_STATUSES)
) as AgentStatus[];

describe("STATUS_META", () => {
  it("has meta for every status the backend can report", () => {
    expect(STATUSES.length).toBeGreaterThan(0);
    for (const s of STATUSES) {
      expect(STATUS_META[s], `missing meta for status "${s}"`).toBeDefined();
    }
  });

  it("uses hex colors and non-empty labels/descriptions", () => {
    for (const s of STATUSES) {
      const meta = STATUS_META[s];
      expect(meta.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(meta.label.trim().length).toBeGreaterThan(0);
      expect(meta.description.trim().length).toBeGreaterThan(0);
    }
  });
});
