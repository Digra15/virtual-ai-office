import { useMemo, useState } from "react";
import {
  ANIMATION_PROFILES,
  WORKER_ROLES,
  type AssetManifestEntry,
  type Service,
  type Worker,
  type WorkerCreate,
  type WorkerUpdate,
} from "@virtual-ai-office/shared";
import {
  createWorker,
  deleteWorker,
  listAssets,
  listServices,
  listWorkers,
  restoreWorker,
  updateWorker,
} from "../api";
import { useResource } from "../useResource";
import { CharacterEditor } from "../CharacterEditor";
import {
  modelOptions,
  supportsForModel,
  validateDraft,
} from "../characterEditorUtils";
import {
  ConfirmDialog,
  Empty,
  Field,
  FormError,
  PageHeader,
  StatusPill,
  toast,
} from "../ui";

// ---------------------------------------------------------------------------
// Worker form (create + edit)
// ---------------------------------------------------------------------------

interface WorkerFormProps {
  worker: Worker | null; // null = create
  services: Service[];
  assets: AssetManifestEntry[];
  onSaved: () => void;
  onCancel: () => void;
}

const ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;

function WorkerForm({ worker, services, assets, onSaved, onCancel }: WorkerFormProps) {
  const isEdit = worker !== null;
  const [id, setId] = useState(worker?.id ?? "");
  const [displayName, setDisplayName] = useState(worker?.displayName ?? "");
  const [role, setRole] = useState<string>(worker?.role ?? "assistant");
  const [description, setDescription] = useState(worker?.description ?? "");
  const [agentSource, setAgentSource] = useState(worker?.agentSource ?? "");
  const [status, setStatus] = useState(worker?.status ?? "offline");
  const [currentTask, setCurrentTask] = useState(worker?.currentTask ?? "");
  const [workstationId, setWorkstationId] = useState(worker?.workstationId ?? "");
  const [publicVisible, setPublicVisible] = useState(worker?.publicVisible ?? true);
  const [characterModel, setCharacterModel] = useState(
    worker?.characterModel ?? "procedural-pixel",
  );
  const [characterConfig, setCharacterConfig] = useState<Record<string, unknown>>(
    worker?.characterConfig ?? {},
  );
  const [accentColor, setAccentColor] = useState(worker?.accentColor ?? "#38bdf8");
  const [animationProfile, setAnimationProfile] = useState<string>(
    worker?.animationProfile ?? "default",
  );
  const [serviceIds, setServiceIds] = useState<string[]>(worker?.services ?? []);
  const [sortOrder, setSortOrder] = useState(String(worker?.sortOrder ?? 0));
  const [archived, setArchived] = useState(worker?.archived ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const supports = useMemo(
    () => supportsForModel(characterModel, assets),
    [characterModel, assets],
  );
  const presetProblems = useMemo(
    () => validateDraft(id || worker?.id || "draft", characterConfig),
    [id, worker, characterConfig],
  );
  const previewAgentId = isEdit ? (worker as Worker).id : id || "draft";

  const toggleService = (sid: string) => {
    setServiceIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid],
    );
  };

  const save = async () => {
    setError(null);
    if (!isEdit) {
      if (!id || !ID_RE.test(id) || id.length > 64) {
        setError("id is required and must be URL-safe (a-z, 0-9, -, _).");
        return;
      }
    }
    if (!displayName.trim()) {
      setError("displayName is required.");
      return;
    }
    if (presetProblems.length > 0) {
      setError(
        `Character preset has problems: ${presetProblems.join("; ")} — fix them in the character editor before saving.`,
      );
      return;
    }
    setSaving(true);
    try {
      const body = {
        displayName: displayName.trim(),
        role,
        description,
        status,
        currentTask,
        workstationId,
        publicVisible,
        characterModel,
        characterConfig,
        accentColor,
        animationProfile,
        services: serviceIds,
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
        archived,
      };
      if (isEdit && worker) {
        // id and agentSource are intentionally NOT sent — the server strips
        // them anyway; renaming never changes the worker's id.
        await updateWorker(worker.id, body as WorkerUpdate);
        toast("Worker updated", "ok");
      } else {
        await createWorker({
          id,
          agentSource,
          ...(body as Omit<WorkerCreate, "id" | "agentSource">),
        });
        toast("Worker created", "ok");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-form">
      <FormError error={error} />
      <div className="admin-grid-2">
        <div>
          {isEdit ? (
            <Field label="Worker id">
              <input type="text" value={worker.id} readOnly disabled aria-readonly="true" />
              <span className="hint">
                Stable integration identity — renaming never changes the worker's id.
              </span>
            </Field>
          ) : (
            <Field label="Worker id" hint="URL-safe, permanent. Never changes after creation.">
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g. nika"
              />
            </Field>
          )}
          <Field
            label="Display name"
            hint={isEdit ? "Renaming never changes the worker's id." : undefined}
          >
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Nika"
            />
          </Field>
          <Field label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {WORKER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </Field>
          {isEdit ? (
            <Field label="Agent source">
              <input type="text" value={worker.agentSource || "—"} readOnly disabled />
              <span className="hint">
                Integration identity — never changes. Archiving or deleting this
                record never terminates the underlying agent.
              </span>
            </Field>
          ) : (
            <Field label="Agent source" hint="Underlying agent/connector identity (opaque).">
              <input
                type="text"
                value={agentSource}
                onChange={(e) => setAgentSource(e.target.value)}
                placeholder="e.g. connector:openai:asst_123"
              />
            </Field>
          )}
          <Field label="Status">
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </Field>
          <Field label="Current task">
            <input
              type="text"
              value={currentTask}
              onChange={(e) => setCurrentTask(e.target.value)}
            />
          </Field>
        </div>
        <div>
          <Field label="Workstation id">
            <input
              type="text"
              value={workstationId}
              onChange={(e) => setWorkstationId(e.target.value)}
              placeholder="e.g. ws-01"
            />
          </Field>
          <Field label="Character model">
            <select
              value={characterModel}
              onChange={(e) => setCharacterModel(e.target.value)}
            >
              {modelOptions(assets).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Accent color">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
            />
          </Field>
          <Field label="Animation profile">
            <select
              value={animationProfile}
              onChange={(e) => setAnimationProfile(e.target.value)}
            >
              {ANIMATION_PROFILES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </Field>
          <div className="checkbox-row">
            <label>
              <input
                type="checkbox"
                checked={publicVisible}
                onChange={(e) => setPublicVisible(e.target.checked)}
              />
              Publicly visible
            </label>
          </div>
          <div className="checkbox-row">
            <label>
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />
              Archived
            </label>
          </div>
          <Field label="Services offered">
            <div className="admin-checklist">
              {services.length === 0 && <span className="muted">No services yet.</span>}
              {services.map((s) => (
                <label key={s.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={serviceIds.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                  />
                  {s.title} <span className="muted">({s.id})</span>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </div>

      <h3>Character</h3>
      <p className="muted">
        The 3D look of this worker. Saved to the worker record as{" "}
        <code>characterConfig</code>.
      </p>
      <CharacterEditor
        agentId={previewAgentId}
        value={characterConfig}
        onChange={setCharacterConfig}
        supports={supports}
      />

      <div className="admin-form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving…" : isEdit ? "Save worker" : "Create worker"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workers page
// ---------------------------------------------------------------------------

export function WorkersPage() {
  const workersRes = useResource(listWorkers);
  const servicesRes = useResource(listServices);
  const assetsRes = useResource(listAssets);
  const [editing, setEditing] = useState<Worker | "new" | null>(null);
  const [confirming, setConfirming] = useState<Worker | null>(null);
  const [busy, setBusy] = useState(false);

  const workers = workersRes.data?.workers ?? [];
  const services = servicesRes.data?.services ?? [];
  const assets = assetsRes.data?.assets ?? [];

  const archive = async (w: Worker) => {
    setBusy(true);
    try {
      await deleteWorker(w.id);
      toast(`Worker "${w.displayName}" archived`, "ok");
      workersRes.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "err");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const restore = async (w: Worker) => {
    setBusy(true);
    try {
      await restoreWorker(w.id);
      toast(`Worker "${w.displayName}" restored`, "ok");
      workersRes.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "err");
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div className="admin-page">
        <PageHeader
          title={editing === "new" ? "New worker" : `Edit ${editing.displayName}`}
          actions={
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              ← Back to list
            </button>
          }
        />
        <div className="admin-panel">
          <WorkerForm
            worker={editing === "new" ? null : editing}
            services={services}
            assets={assets}
            onSaved={() => {
              setEditing(null);
              workersRes.refresh();
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeader
        title="Workers"
        sub={`${workers.length} worker records. Archiving disables a worker publicly but never terminates the underlying agent.`}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditing("new")}
          >
            + New worker
          </button>
        }
      />
      {workersRes.loading ? (
        <p className="muted">Loading…</p>
      ) : workersRes.error ? (
        <p className="error-text" role="alert">
          {workersRes.error}
        </p>
      ) : workers.length === 0 ? (
        <Empty text="No workers yet. Create the first one." />
      ) : (
        <div className="admin-panel">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Display name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Workstation</th>
                  <th>Public</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id} className={w.archived ? "archived" : ""}>
                    <td>
                      <strong>{w.displayName}</strong>
                      <div className="muted small">
                        <code>{w.id}</code>
                      </div>
                      {w.archived && <StatusPill text="archived" tone="warn" />}
                    </td>
                    <td>{w.role}</td>
                    <td>{w.status}</td>
                    <td>{w.workstationId || "—"}</td>
                    <td>{w.publicVisible ? "yes" : "no"}</td>
                    <td className="admin-row-actions">
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setEditing(w)}
                      >
                        Edit
                      </button>
                      {w.archived ? (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => restore(w)}
                          disabled={busy}
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setConfirming(w)}
                        >
                          Archive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {confirming && (
        <ConfirmDialog
          title="Archive worker?"
          body={
            <>
              <p>
                <strong>{confirming.displayName}</strong> (
                <code>{confirming.id}</code>) will be hidden from the public
                scene and the service catalog.
              </p>
              <p>
                This disables it publicly but <strong>never terminates</strong>{" "}
                the underlying agent — you can restore it any time.
              </p>
            </>
          }
          confirmLabel="Archive worker"
          busy={busy}
          onConfirm={() => archive(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
