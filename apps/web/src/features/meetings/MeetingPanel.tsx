import { useState } from "react";
import { useAgentStore } from "../../stores/useAgentStore";
import { useMeetingStore } from "../../stores/useMeetingStore";
import { STATUS_META } from "../../utils/status";

/**
 * Meeting control panel: start A2A meetings, watch the (simulated)
 * transcript live, read auto-generated minutes, and browse the archive.
 *
 * Honest labeling: every transcript turn and the minutes carry a
 * "simulated" badge — the A2A envelope is real, the transport is a
 * local simulation until real agent connectors exist.
 */
export function MeetingPanel({ onClose }: { onClose: () => void }) {
  const agents = useAgentStore((s) => s.agents);
  const meetings = useMeetingStore((s) => s.meetings);
  const activeMeetingId = useMeetingStore((s) => s.activeMeetingId);
  const startMeeting = useMeetingStore((s) => s.startMeeting);
  const endMeeting = useMeetingStore((s) => s.endMeeting);
  const dismissMeeting = useMeetingStore((s) => s.dismissMeeting);

  const [topic, setTopic] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const agentList = Object.values(agents).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const active = meetings.find((m) => m.id === activeMeetingId) ?? null;
  const archived = meetings.filter((m) => m.phase === "done");

  const togglePick = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    setError(null);
  };

  const handleStart = () => {
    try {
      startMeeting(picked, topic);
      setTopic("");
      setPicked([]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="side-panel meeting-panel" role="dialog" aria-label="Meetings">
      <div className="side-panel-header">
        <h2>Meetings</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close meetings">
          ✕
        </button>
      </div>

      {active ? (
        <div className="meeting-active">
          <h3>{active.topic}</h3>
          <p className="muted">
            {active.phase === "toMeeting"
              ? `Walking to the meeting room… (${active.arrivedIds.length}/${active.participantIds.length} seated)`
              : "In session"}
          </p>
          <div className="transcript" aria-live="polite">
            {active.transcript.map((msg) => (
              <div key={msg.id} className={`a2a-msg a2a-${msg.type}`}>
                {msg.type === "meeting.invite" && (
                  <p>
                    ✉️ Invite → {(msg.payload as { topic: string }).topic}
                    <span className="sim-badge">SIMULATED</span>
                  </p>
                )}
                {msg.type === "meeting.turn" && (
                  <p>
                    <strong>
                      {(msg.payload as { speakerName: string }).speakerName}
                    </strong>{" "}
                    <span className="muted">
                      ({(msg.payload as { speakerRole: string }).speakerRole})
                    </span>
                    : {(msg.payload as { text: string }).text}
                    <span className="sim-badge">SIMULATED</span>
                  </p>
                )}
                {msg.type === "meeting.minutes" && (
                  <div className="minutes">
                    <strong>📝 Minutes</strong>
                    <span className="sim-badge">SIMULATED</span>
                    <pre>{active.minutes}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="primary-btn" onClick={endMeeting}>
            End meeting &amp; walk back
          </button>
        </div>
      ) : (
        <div className="meeting-new">
          <h3>New meeting</h3>
          <input
            type="text"
            className="text-input"
            placeholder="Topic, e.g. Q4 launch plan"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            aria-label="Meeting topic"
          />
          <p className="muted">Pick 2–4 agents:</p>
          <div className="agent-pick-list">
            {agentList.map((a) => (
              <label key={a.id} className="agent-pick">
                <input
                  type="checkbox"
                  checked={picked.includes(a.id)}
                  onChange={() => togglePick(a.id)}
                />
                <span
                  className="dot"
                  style={{ backgroundColor: STATUS_META[a.status].color }}
                />
                {a.name}
                <span className="muted">· {a.role}</span>
              </label>
            ))}
          </div>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="primary-btn"
            onClick={handleStart}
            disabled={picked.length < 2 || topic.trim() === ""}
          >
            Start meeting ({picked.length} agents)
          </button>
          <p className="muted small">
            Agents walk to the meeting room over the A2A protocol. Dialogue is
            template-simulated and labeled as such.
          </p>
        </div>
      )}

      {archived.length > 0 && (
        <div className="meeting-archive">
          <h3>Past meetings</h3>
          {archived.map((m) => (
            <details key={m.id} className="meeting-archived-item">
              <summary>
                {m.topic}
                <span className="muted small">
                  {" "}
                  · {m.participantIds.length} agents
                </span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    dismissMeeting(m.id);
                  }}
                  aria-label={`Dismiss meeting ${m.topic}`}
                >
                  dismiss
                </button>
              </summary>
              {m.minutes && (
                <pre className="minutes small">
                  {m.minutes}
                  {"\n"}
                  <span className="sim-badge">SIMULATED</span>
                </pre>
              )}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
