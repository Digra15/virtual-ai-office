import { useState } from "react";
import { SpawnPanel } from "../../features/agents/SpawnPanel";
import { PageHeader } from "../ui";

/**
 * Mission control — spawn, moved from the main dashboard. Spawned agents
 * land in the shared agent store (visible on the Agen page) and appear in
 * the 3D lobby when a tab with the office scene is open.
 */
export function MissionSpawnPage() {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <PageHeader
        title="Spawn"
        sub="Buat agen simulasi baru — dipindah dari dashboard utama."
      />
      {open ? (
        <SpawnPanel onClose={() => setOpen(false)} />
      ) : (
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          Spawn agent
        </button>
      )}
    </div>
  );
}
