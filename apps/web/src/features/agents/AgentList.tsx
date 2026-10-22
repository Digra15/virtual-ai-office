import { useMemo, useState } from "react";
import { useAgentStore, type StatusFilter } from "../../stores/useAgentStore";
import { useOfficeConfigStore } from "../../stores/useOfficeConfigStore";
import { ALL_STATUSES, STATUS_META } from "../../utils/status";
import { AgentCard } from "./AgentCard";

/**
 * Sidebar agent list with text search + status filter chips.
 * Reads from the agent store (tests seed it via applySnapshot).
 */
export function AgentList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const agents = useAgentStore((s) => s.agents);
  const selectedId = useAgentStore((s) => s.selectedId);
  const select = useAgentStore((s) => s.select);
  const selectFiltered = useAgentStore((s) => s.selectFiltered);
  // Agents whose worker record is non-public are hidden from the list.
  // Agents without a worker record stay visible; empty when unconfigured.
  const hiddenWorkerIds = useOfficeConfigStore((s) => s.hiddenWorkerIds);

  const list = useMemo(
    () =>
      selectFiltered(search, statusFilter).filter(
        (a) => !hiddenWorkerIds.includes(a.id),
      ),
    [selectFiltered, search, statusFilter, agents, hiddenWorkerIds],
  );

  return (
    <section className="agent-list" aria-label="Agents">
      <h2>Agents ({list.length})</h2>
      <input
        type="search"
        className="search-input"
        placeholder="Search agents…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search agents"
      />
      <div className="chip-row" role="group" aria-label="Filter by status">
        <button
          type="button"
          className={`chip${statusFilter === "all" ? " active" : ""}`}
          onClick={() => setStatusFilter("all")}
          aria-label="Show all statuses"
          aria-pressed={statusFilter === "all"}
        >
          All
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={`chip${statusFilter === s ? " active" : ""}`}
            onClick={() => setStatusFilter(s)}
            aria-label={`Filter by ${STATUS_META[s].label}`}
            aria-pressed={statusFilter === s}
          >
            <span
              className="dot"
              style={{ backgroundColor: STATUS_META[s].color }}
              aria-hidden="true"
            />
            {STATUS_META[s].label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="empty-state">
          No agents match your filters. Try a different search or status.
        </div>
      ) : (
        <div className="agent-cards">
          {list.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              selected={agent.id === selectedId}
              onSelect={() => select(agent.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
