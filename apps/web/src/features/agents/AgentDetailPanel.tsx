import { useEffect, useMemo, useState } from "react";
import type { ActivityEntry, AgentInfo } from "@virtual-ai-office/shared";
import { useConnectionStore } from "../../stores/useConnectionStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useOccupancyStore } from "../../stores/useOccupancyStore";
import { fetchEvents } from "../../services/api";
import { STATUS_META } from "../../utils/status";
import { formatTime, timeAgo } from "../../utils/format";
import { CharacterPreview } from "./CharacterPreview";
import {
  canMarkResolved,
  markResolved,
  resolveError,
  sendToRecovery,
  simulateError,
} from "../recovery/recoveryLogic";

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

  // --- Recovery section -------------------------------------------------
  const bedId = useOccupancyStore((s) => s.bedOf(agent.id));
  const workstationId = useOccupancyStore((s) =>
    s.workstationOf(agent.id, agent.workstationId),
  );
  const room = useOccupancyStore((s) => s.roomOf(agent.id, agent.workstationId));
  const [recoveryNote, setRecoveryNote] = useState<string | null>(null);
  const showRecovery =
    agent.status === "error" || agent.status === "recovering" || bedId !== null;

  const runRecoveryAction = (label: string, fn: () => void) => {
    setRecoveryNote(null);
    try {
      fn();
    } catch (err) {
      setRecoveryNote(`${label} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

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

      <CharacterPreview agent={agent} />

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
        <span className="v">{workstationId ?? agent.workstationId}</span>
      </div>
      <div className="detail-row">
        <span className="k">Room</span>
        <span className="v">
          {room ? `${room.name} (floor ${room.floor})` : "Unknown"}
        </span>
      </div>
      <div className="detail-row">
        <span className="k">Source</span>
        <span className="v">{agent.source === "demo" ? "Simulated" : "Live"}</span>
      </div>

      {showRecovery && (
        <div>
          <h3 className="section-title" style={{ marginBottom: 8 }}>
            Recovery
          </h3>
          <div className="detail-row">
            <span className="k">Error</span>
            <span className="v">Unknown error (simulated data)</span>
          </div>
          <div className="detail-row">
            <span className="k">Recovery bed</span>
            <span className="v">{bedId ?? "—"}</span>
          </div>
          {recoveryNote && (
            <div className="empty-state" role="status">
              {recoveryNote}
            </div>
          )}
          <div
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}
          >
            <button
              type="button"
              className="btn"
              disabled={bedId !== null || agent.status !== "error"}
              onClick={() =>
                runRecoveryAction("Send to recovery", () => {
                  const res = sendToRecovery(agent.id);
                  setRecoveryNote(
                    res.ok
                      ? `Walking to ${res.bedId}…`
                      : `Could not dispatch: ${res.reason}`,
                  );
                })
              }
              title="Walk this agent to a free recovery bed (manual action)"
            >
              Send to recovery
            </button>
            <button
              type="button"
              className="btn"
              disabled={!canMarkResolved(agent.status)}
              onClick={() =>
                runRecoveryAction("Mark resolved", () => {
                  markResolved(agent.id);
                  setRecoveryNote("Marked resolved — returning to workstation.");
                })
              }
              title="Mark the error resolved (manual action); the agent walks back to its desk"
            >
              Mark resolved
            </button>
            <button
              type="button"
              className="btn"
              disabled={agent.status === "error" || agent.status === "recovering"}
              onClick={() =>
                runRecoveryAction("Simulate error", () => {
                  simulateError(agent.id);
                  setRecoveryNote("SIMULATED error injected.");
                })
              }
              title="SIMULATED: inject a synthetic error for workflow testing"
            >
              Simulate error (SIMULATED)
            </button>
            <button
              type="button"
              className="btn"
              disabled={agent.status !== "error"}
              onClick={() =>
                runRecoveryAction("Clear error", () => {
                  resolveError(agent.id);
                  setRecoveryNote("SIMULATED error cleared.");
                })
              }
              title="SIMULATED: clear the synthetic error"
            >
              Clear error (SIMULATED)
            </button>
          </div>
          <p className="seen" style={{ marginTop: 8 }}>
            Simulation controls are labeled SIMULATED and only touch the local
            demo store — they never claim a backend-confirmed recovery.
          </p>
        </div>
      )}

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
