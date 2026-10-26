import { useState } from "react";
import { MeetingPanel } from "../../features/meetings/MeetingPanel";
import { PageHeader } from "../ui";
import { useMissionAgents } from "./useMissionAgents";

/**
 * Mission control — meetings, moved from the main dashboard. Starting a
 * meeting from here records the same A2A state; agents physically walk
 * only while a tab with the 3D office is open (movement is driven by
 * the scene's frame loop).
 */
export function MissionMeetingPage() {
  const { error } = useMissionAgents();
  const [open, setOpen] = useState(true);

  return (
    <div>
      <PageHeader
        title="Meeting"
        sub="Panel meeting A2A — dipindah dari dashboard utama."
      />
      {error && (
        <p className="error-text" role="alert">
          Gagal memuat daftar agen: {error}
        </p>
      )}
      {open ? (
        <MeetingPanel onClose={() => setOpen(false)} />
      ) : (
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          Buka panel meeting
        </button>
      )}
    </div>
  );
}
