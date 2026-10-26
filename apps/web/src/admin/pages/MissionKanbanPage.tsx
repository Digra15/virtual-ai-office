import { useState } from "react";
import { KanbanBoard } from "../../features/kanban/KanbanBoard";
import { PageHeader } from "../ui";
import { useMissionAgents } from "./useMissionAgents";

/**
 * Mission control — task board, moved from the main dashboard. The board
 * seeds from the agent roster on mount (same seed the dashboard ran on
 * its live snapshot).
 */
export function MissionKanbanPage() {
  const { error } = useMissionAgents();
  const [open, setOpen] = useState(true);

  return (
    <div>
      <PageHeader
        title="Kanban"
        sub="Papan tugas agen — dipindah dari dashboard utama."
      />
      {error && (
        <p className="error-text" role="alert">
          Gagal memuat daftar agen: {error}
        </p>
      )}
      {open ? (
        <KanbanBoard onClose={() => setOpen(false)} />
      ) : (
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          Buka papan tugas
        </button>
      )}
    </div>
  );
}
