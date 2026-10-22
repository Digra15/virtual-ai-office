/**
 * Recovery admin page: the recovery-workflow config (`office.recovery`)
 * and the error-event list from the Worker (`GET /api/admin/error-events`).
 *
 * Error events are real backend records — nothing here is simulated. When
 * the backend is unconfigured the list shows an honest empty state instead
 * of mock data.
 */
import { useEffect, useState } from "react";
import {
  OFFICE_CONFIG_SCHEMAS,
  type ErrorEvent,
  type ErrorEventStatus,
} from "@virtual-ai-office/shared";
import { RECOVERY_BEDS } from "../../world/building/floorPlan";
import {
  createErrorEvent,
  getConfig,
  listErrorEvents,
  putConfigKey,
  updateErrorEvent,
} from "../api";
import { useResource } from "../useResource";
import { Empty, Field, FormError, PageHeader, StatusPill, toast } from "../ui";

const EVENT_TONES: Record<ErrorEventStatus, string> = {
  open: "bad",
  acknowledged: "warn",
  resolved: "ok",
};

// ---------------------------------------------------------------------------
// Recovery config editor
// ---------------------------------------------------------------------------

function RecoveryConfigEditor() {
  const configRes = useResource(getConfig);
  const [enabled, setEnabled] = useState(true);
  const [autoRecover, setAutoRecover] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stored = configRes.data?.config?.["office.recovery"] as
    | { enabled?: unknown; autoRecover?: unknown; notifyOnError?: unknown }
    | undefined;

  useEffect(() => {
    if (configRes.data && !initialized) {
      if (typeof stored?.enabled === "boolean") setEnabled(stored.enabled);
      if (typeof stored?.autoRecover === "boolean")
        setAutoRecover(stored.autoRecover);
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configRes.data]);

  const save = async () => {
    const schema = OFFICE_CONFIG_SCHEMAS["office.recovery"];
    const parsed = schema.safeParse({
      enabled,
      autoRecover,
      capacity: RECOVERY_BEDS.length,
      notifyOnError:
        typeof stored?.notifyOnError === "boolean" ? stored.notifyOnError : true,
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      );
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await putConfigKey("office.recovery", parsed.data);
      toast("Saved — recovery config updates live", "ok");
      configRes.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-panel">
      <h3>Recovery workflow</h3>
      <p className="hint">
        Controls the automatic recovery of errored agents. Capacity is the
        scene's recovery-bed count ({RECOVERY_BEDS.length} beds).
      </p>
      {configRes.loading && !initialized ? (
        <p className="muted">Loading…</p>
      ) : configRes.error && !initialized ? (
        <p className="error-text" role="alert">
          {configRes.error}
        </p>
      ) : (
        <>
          <Field label="Recovery workflow">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Enabled — the recovery workflow runs at all
            </label>
          </Field>
          <Field label="Automatic recovery">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={autoRecover}
                onChange={(e) => setAutoRecover(e.target.checked)}
                disabled={!enabled}
              />
              Auto-recover — walk errored agents to a free bed automatically
            </label>
          </Field>
          <div className="detail-row">
            <span className="k">Bed capacity</span>
            <span className="v">{RECOVERY_BEDS.length} beds</span>
          </div>
          <FormError error={error} />
          <div className="admin-form-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          <p className="hint">
            Persisted to the <code>office.recovery</code> config key.
          </p>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Error event list
// ---------------------------------------------------------------------------

function ErrorEventRow({
  event,
  onChanged,
}: {
  event: ErrorEvent;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<ErrorEventStatus | null>(null);

  const transition = async (status: ErrorEventStatus) => {
    setBusy(status);
    try {
      await updateErrorEvent(event.id, { status });
      toast(
        status === "resolved" ? "Event resolved" : "Event acknowledged",
        "ok",
      );
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "err");
    } finally {
      setBusy(null);
    }
  };

  return (
    <tr>
      <td>
        <code>{event.id}</code>
        <div className="muted small">agent: {event.agentId}</div>
      </td>
      <td>
        <StatusPill text={event.category} />
      </td>
      <td className="muted small" style={{ maxWidth: 320 }}>
        {event.message || "—"}
      </td>
      <td>
        <StatusPill text={event.status} tone={EVENT_TONES[event.status]} />
      </td>
      <td className="muted small">
        {new Date(event.createdAt).toLocaleString()}
      </td>
      <td>
        <span className="admin-btn-row">
          {event.status === "open" && (
            <button
              type="button"
              className="btn"
              disabled={busy !== null}
              onClick={() => transition("acknowledged")}
            >
              {busy === "acknowledged" ? "…" : "Acknowledge"}
            </button>
          )}
          {event.status !== "resolved" && (
            <button
              type="button"
              className="btn"
              disabled={busy !== null}
              onClick={() => transition("resolved")}
            >
              {busy === "resolved" ? "…" : "Resolve"}
            </button>
          )}
        </span>
      </td>
    </tr>
  );
}

function ErrorEventList() {
  const eventsRes = useResource(listErrorEvents);
  const [agentId, setAgentId] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!agentId.trim()) {
      toast("Agent id is required", "err");
      return;
    }
    setCreating(true);
    try {
      await createErrorEvent({
        agentId: agentId.trim(),
        category: "unknown",
        message: message.trim(),
      });
      toast("Error event recorded", "ok");
      setAgentId("");
      setMessage("");
      eventsRes.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "err");
    } finally {
      setCreating(false);
    }
  };

  const events: ErrorEvent[] = eventsRes.data?.events ?? [];
  const unavailable =
    eventsRes.error !== null &&
    (eventsRes.error.includes("Network error") ||
      eventsRes.error.includes("Failed to fetch"));

  return (
    <section className="admin-panel">
      <h3>Error events</h3>
      <p className="hint">
        Real records from the Worker — reported agent failures and their
        acknowledgement lifecycle. Nothing here is simulated.
      </p>
      {eventsRes.loading ? (
        <p className="muted">Loading…</p>
      ) : unavailable || eventsRes.error ? (
        <Empty
          text={
            unavailable
              ? "Error events unavailable — the Worker backend is not configured (set VITE_API_URL and redeploy)."
              : eventsRes.error ?? "Could not load error events."
          }
        />
      ) : events.length === 0 ? (
        <Empty text="No error events recorded." />
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Category</th>
              <th>Message</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <ErrorEventRow key={e.id} event={e} onChanged={eventsRes.refresh} />
            ))}
          </tbody>
        </table>
      )}
      <h4 style={{ marginTop: 16 }}>Record an error event</h4>
      <div className="admin-grid-3 admin-row-gap">
        <input
          type="text"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="agent id"
          aria-label="Agent id"
        />
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="message (optional)"
          aria-label="Error message"
        />
        <button
          type="button"
          className="btn"
          onClick={create}
          disabled={creating}
        >
          {creating ? "Recording…" : "Record event"}
        </button>
      </div>
      <p className="hint">
        Manual recording is for real incidents you observed — the dashboard's
        own simulation controls stay in the public agent panel, labeled
        SIMULATED.
      </p>
    </section>
  );
}

export function RecoveryPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Recovery"
        sub="Automatic recovery of errored agents and the error-event lifecycle."
      />
      <RecoveryConfigEditor />
      <ErrorEventList />
    </div>
  );
}
