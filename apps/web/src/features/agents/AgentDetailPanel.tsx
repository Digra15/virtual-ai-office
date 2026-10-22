import { useEffect, useMemo, useState } from "react";
import type { ActivityEntry, AgentInfo } from "@virtual-ai-office/shared";
import { useConnectionStore } from "../../stores/useConnectionStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { fetchEvents } from "../../services/api";
import { STATUS_META } from "../../utils/status";
import { formatTime, timeAgo } from "../../utils/format";

interface AgentDetailPanelProps {
  agent: AgentInfo;
  onClose: () => void;
}

/**
 * Right-side detail panel for the selected agent. When connected live, it
 * also pulls the agent's recent events from the REST API and merges them
 * with the activity history already in the store (deduplicated by id).
 */
export function AgentDetailPanel({ agent, onClose }: AgentDetailPanelProps) {
  const connStatus = useConnectionStore((s) => s.status);
  const apiUrl = useSettingsStore((s) => s.apiUrl);
  const [remoteEvents, setRemoteEvents] = useState<ActivityEntry[] | null>(null);

  useEffect(() => {
    setRemoteEvents(null);
    if (connStatus !== "live" || !apiUrl) return;
    let cancelled = false;
    fetchEvents(apiUrl, agent.id, 30)
      .then((events) => {
        if (!cancelled) setRemoteEvents(events);
      })
      .catch(() => {
        if (!cancelled) setRemoteEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [agent.id, connStatus, apiUrl]);

  const events = useMemo(() => {
    const seen = new Set<string>();
    const merged: ActivityEntry[] = [];
    for (const e of [...(remoteEvents ?? []), ...agent.activityHistory]) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        merged.push(e);
      }
    }
    return merged
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 50);
  }, [remoteEvents, agent.activityHistory]);

  const meta = STATUS_META[agent.status];

  return (
    <aside className="detail-panel" aria-label={`Details for ${agent.name}`}>
      <div className="detail-header">
        <div>
          <h2>{agent.name}</h2>
          <div className="role">{agent.role}</div>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="Close agent details"
        >
          ✕
        </button>
      </div>

      <div>
        <span className="status-pill" style={{ color: meta.color }}>
          <span
            className="status-dot"
            style={{ backgroundColor: meta.color }}
            aria-hidden="true"
          />
          {meta.label}
        </span>
      </div>

      {agent.currentTask && (
        <div className="detail-task">
          <strong>Current task:</strong> {agent.currentTask}
        </div>
      )}

      {agent.progress !== null && agent.progress !== undefined && (
        <div>
          <div
            className="progress"
            role="progressbar"
            aria-valuenow={agent.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${agent.name} progress`}
          >
            <div style={{ width: `${agent.progress}%` }} />
          </div>
          <div className="seen" style={{ marginTop: 4 }}>
            {agent.progress}% complete
          </div>
        </div>
      )}

      <div className="detail-row">
        <span className="k">Last seen</span>
        <span className="v">
          {formatTime(agent.lastSeen)} ({timeAgo(agent.lastSeen)})
        </span>
      </div>
      <div className="detail-row">
        <span className="k">Workstation</span>
        <span className="v">{agent.workstationId}</span>
      </div>
      <div className="detail-row">
        <span className="k">Source</span>
        <span className="v">{agent.source === "demo" ? "Simulated" : "Live"}</span>
      </div>

      <div>
        <h3 className="section-title" style={{ marginBottom: 8 }}>
          Activity
        </h3>
        {events.length === 0 ? (
          <div className="empty-state">No activity recorded yet.</div>
        ) : (
          <div className="activity-list">
            {events.map((e) => (
              <div key={e.id} className="activity-item">
                <span className="time">
                  {formatTime(e.timestamp)} · {e.kind}
                </span>
                {e.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
