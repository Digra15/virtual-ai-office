import { useState } from "react";
import { useAgentStore } from "../../stores/useAgentStore";
import { AgentDetailPanel } from "../../features/agents/AgentDetailPanel";
import { STATUS_META } from "../../utils/status";
import { PageHeader } from "../ui";
import { useMissionAgents } from "./useMissionAgents";

/**
 * Mission control — agents, moved from the main dashboard. Pick an agent
 * from the roster to open the same detail panel (status, task, activity,
 * recovery actions); closing it returns to the roster.
 */
export function MissionAgentsPage() {
  const { error } = useMissionAgents();
  const agents = useAgentStore((s) => s.agents);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = Object.values(agents).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const selected = selectedId ? agents[selectedId] : null;

  return (
    <div>
      <PageHeader
        title="Agen"
        sub="Daftar agen live dan panel detailnya — dipindah dari dashboard utama."
      />
      {error && (
        <p className="error-text" role="alert">
          Gagal memuat daftar agen: {error}
        </p>
      )}
      {selected ? (
        <AgentDetailPanel agent={selected} onClose={() => setSelectedId(null)} />
      ) : list.length === 0 ? (
        <p className="muted">
          Belum ada agen yang dimuat. Buka dashboard utama sekali, atau
          periksa koneksi backend.
        </p>
      ) : (
        <ul>
          {list.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className="link-btn"
                onClick={() => setSelectedId(a.id)}
              >
                <span
                  className="dot"
                  style={{ backgroundColor: STATUS_META[a.status].color }}
                />{" "}
                {a.name}
              </button>{" "}
              <span className="muted">
                · {a.role} · {STATUS_META[a.status].label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
