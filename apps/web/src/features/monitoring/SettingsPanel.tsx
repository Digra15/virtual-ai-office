import { useState } from "react";
import { useSettingsStore } from "../../stores/useSettingsStore";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Settings modal: backend URLs, stress-mode toggle, manual reconnect.
 * URL edits are persisted to localStorage by the settings store.
 */
export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const apiUrl = useSettingsStore((s) => s.apiUrl);
  const wsUrl = useSettingsStore((s) => s.wsUrl);
  const stressMode = useSettingsStore((s) => s.stressMode);
  const setApiUrl = useSettingsStore((s) => s.setApiUrl);
  const setWsUrl = useSettingsStore((s) => s.setWsUrl);
  const toggleStressMode = useSettingsStore((s) => s.toggleStressMode);
  const reconnect = useSettingsStore((s) => s.reconnect);

  const [apiDraft, setApiDraft] = useState(apiUrl);
  const [wsDraft, setWsDraft] = useState(wsUrl);

  if (!open) return null;

  const save = () => {
    setApiUrl(apiDraft.trim());
    setWsUrl(wsDraft.trim());
    reconnect(); // reconnect with the new URLs
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Settings</h2>

        <div className="field">
          <label htmlFor="settings-api-url">Backend REST URL</label>
          <input
            id="settings-api-url"
            type="text"
            value={apiDraft}
            onChange={(e) => setApiDraft(e.target.value)}
            placeholder="http://localhost:4000"
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label htmlFor="settings-ws-url">Backend WebSocket URL</label>
          <input
            id="settings-ws-url"
            type="text"
            value={wsDraft}
            onChange={(e) => setWsDraft(e.target.value)}
            placeholder="ws://localhost:4000/ws"
            spellCheck={false}
          />
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={stressMode}
            onChange={toggleStressMode}
            aria-label="Stress mode: add 22 simulated agents"
          />
          Stress mode — add 22 simulated agents to the office
        </label>

        <p className="hint">
          Agents are marked offline if the backend sees no heartbeat or event
          within its offline timeout (default 30s). Leave a URL empty to fall
          back to local simulated data.
        </p>

        <div className="modal-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              reconnect();
              onClose();
            }}
            aria-label="Reconnect to backend now"
          >
            Reconnect now
          </button>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            aria-label="Save settings"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
