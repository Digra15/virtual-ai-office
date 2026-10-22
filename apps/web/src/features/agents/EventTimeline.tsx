import { useState } from "react";
import { useAgentStore } from "../../stores/useAgentStore";
import { formatTime } from "../../utils/format";

/** Collapsible bottom drawer with the global event feed (newest first). */
export function EventTimeline() {
  const [open, setOpen] = useState(true);
  const events = useAgentStore((s) => s.globalEvents);
  const agents = useAgentStore((s) => s.agents);

  return (
    <div className="event-drawer">
      <button
        type="button"
        className="event-drawer-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Collapse event timeline" : "Expand event timeline"}
      >
        <span>Event timeline ({events.length})</span>
        <span aria-hidden="true">{open ? "▾" : "▴"}</span>
      </button>
      {open && (
        <div className="event-drawer-body">
          {events.length === 0 ? (
            <div className="empty-state">No events yet.</div>
          ) : (
            events.map((e) => (
              <div key={e.id} className="event-item">
                <span className="time">{formatTime(e.timestamp)}</span>
                <span className="who">{agents[e.agentId]?.name ?? e.agentId}</span>
                <span>{e.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
