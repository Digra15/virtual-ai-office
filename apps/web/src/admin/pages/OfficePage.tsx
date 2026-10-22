import { useState } from "react";
import {
  OFFICE_CONFIG_SCHEMAS,
  THEME_PRESETS,
  type OfficeConfigKey,
  type RoomConfig,
  type WorkstationConfig,
  type Worker,
} from "@virtual-ai-office/shared";
import { getConfig, listWorkers, putConfigKey } from "../api";
import { useResource } from "../useResource";
import { Empty, Field, FormError, PageHeader, toast } from "../ui";

type EditableKey = Exclude<OfficeConfigKey, "office.branding" | "office.recovery">;
// "office.recovery" is curated on the dedicated Recovery admin page.

const EDITABLE_KEYS: EditableKey[] = [
  "office.theme",
  "office.rooms",
  "office.workstations",
  "office.assignments",
  "office.visibility",
  "office.camera",
];

function ConfigSection({
  title,
  children,
  onSave,
  saving,
  note,
}: {
  title: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  note?: string;
}) {
  return (
    <section className="admin-panel">
      <h3>{title}</h3>
      {note && <p className="hint">{note}</p>}
      {children}
      <div className="admin-form-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Per-key editors
// ---------------------------------------------------------------------------

function ThemeEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const v = typeof value === "string" ? value : "midnight";
  return (
    <Field label="Theme preset">
      <select value={v} onChange={(e) => onChange(e.target.value)}>
        {THEME_PRESETS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </Field>
  );
}

function RoomsEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const rooms: RoomConfig[] = Array.isArray(value) ? (value as RoomConfig[]) : [];
  const set = (i: number, patch: Partial<RoomConfig>) =>
    onChange(rooms.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div>
      {rooms.map((r, i) => (
        <div key={i} className="admin-grid-3 admin-row-gap">
          <input
            type="text"
            value={r.id}
            onChange={(e) => set(i, { id: e.target.value })}
            placeholder="room id"
          />
          <input
            type="text"
            value={r.name}
            onChange={(e) => set(i, { name: e.target.value })}
            placeholder="Room name"
          />
          <span className="admin-btn-row">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={r.visible}
                onChange={(e) => set(i, { visible: e.target.checked })}
              />
              Visible
            </label>
            <button
              type="button"
              className="btn"
              onClick={() => onChange(rooms.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </span>
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() => onChange([...rooms, { id: "", name: "", visible: true }])}
      >
        + Add room
      </button>
    </div>
  );
}

function WorkstationsEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const list: WorkstationConfig[] = Array.isArray(value)
    ? (value as WorkstationConfig[])
    : [];
  const set = (i: number, patch: Partial<WorkstationConfig>) =>
    onChange(list.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  return (
    <div>
      <div className="admin-grid-ws admin-row-gap admin-ws-head">
        <span>id</span>
        <span>x</span>
        <span>z</span>
        <span>rotY</span>
        <span>label</span>
        <span>enabled</span>
        <span></span>
      </div>
      {list.map((w, i) => (
        <div key={i} className="admin-grid-ws admin-row-gap">
          <input
            type="text"
            value={w.id}
            onChange={(e) => set(i, { id: e.target.value })}
          />
          <input
            type="number"
            value={w.position?.[0] ?? 0}
            onChange={(e) =>
              set(i, { position: [Number(e.target.value), w.position?.[1] ?? 0] })
            }
          />
          <input
            type="number"
            value={w.position?.[1] ?? 0}
            onChange={(e) =>
              set(i, { position: [w.position?.[0] ?? 0, Number(e.target.value)] })
            }
          />
          <input
            type="number"
            value={w.rotationY ?? 0}
            onChange={(e) => set(i, { rotationY: Number(e.target.value) })}
          />
          <input
            type="text"
            value={w.label ?? ""}
            onChange={(e) => set(i, { label: e.target.value })}
          />
          <input
            type="checkbox"
            checked={w.enabled ?? true}
            onChange={(e) => set(i, { enabled: e.target.checked })}
          />
          <button
            type="button"
            className="btn"
            onClick={() => onChange(list.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn"
        onClick={() =>
          onChange([
            ...list,
            { id: "", position: [0, 0], rotationY: 0, label: "", enabled: true },
          ])
        }
      >
        + Add workstation
      </button>
    </div>
  );
}

function AssignmentsEditor({
  value,
  onChange,
  workers,
  workstations,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  workers: Worker[];
  workstations: WorkstationConfig[];
}) {
  const map: Record<string, string> =
    value && typeof value === "object" ? (value as Record<string, string>) : {};
  const entries = Object.entries(map);
  const setEntry = (workerId: string, wsId: string) => {
    const next = { ...map };
    if (!wsId) delete next[workerId];
    else next[workerId] = wsId;
    onChange(next);
  };
  return (
    <div>
      {entries.map(([workerId, wsId]) => (
        <div key={workerId} className="admin-grid-3 admin-row-gap">
          <select
            value={workerId}
            onChange={(e) => {
              const next = { ...map };
              delete next[workerId];
              next[e.target.value] = wsId;
              onChange(next);
            }}
          >
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.displayName} ({w.id})
              </option>
            ))}
          </select>
          <select value={wsId} onChange={(e) => setEntry(workerId, e.target.value)}>
            <option value="">— none —</option>
            {workstations.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label || w.id} ({w.id})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const next = { ...map };
              delete next[workerId];
              onChange(next);
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn"
        disabled={workers.length === 0}
        onClick={() => {
          const first = workers.find((w) => !(w.id in map));
          if (first) onChange({ ...map, [first.id]: "" });
        }}
      >
        + Add assignment
      </button>
    </div>
  );
}

function VisibilityEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const v =
    value && typeof value === "object"
      ? (value as { publicScene?: boolean; showOffline?: boolean })
      : {};
  return (
    <div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={v.publicScene ?? true}
          onChange={(e) => onChange({ ...v, publicScene: e.target.checked })}
        />
        Public scene visible
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={v.showOffline ?? true}
          onChange={(e) => onChange({ ...v, showOffline: e.target.checked })}
        />
        Show offline agents
      </label>
    </div>
  );
}

function CameraEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const v =
    value && typeof value === "object"
      ? (value as { position?: number[]; target?: number[]; fov?: number })
      : {};
  const num = (arr: number[] | undefined, i: number, fallback: number) =>
    arr?.[i] ?? fallback;
  const setArr = (key: "position" | "target", i: number, val: number) => {
    const arr = [0, 1, 2].map((j) =>
      j === i ? val : num(key === "position" ? v.position : v.target, j, 0),
    );
    onChange({ ...v, [key]: arr });
  };
  return (
    <div>
      <Field label="Camera position [x, y, z]">
        <div className="admin-grid-3">
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              type="number"
              value={num(v.position, i, [16, 13, 16][i])}
              onChange={(e) => setArr("position", i, Number(e.target.value))}
            />
          ))}
        </div>
      </Field>
      <Field label="Camera target [x, y, z]">
        <div className="admin-grid-3">
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              type="number"
              value={num(v.target, i, 0)}
              onChange={(e) => setArr("target", i, Number(e.target.value))}
            />
          ))}
        </div>
      </Field>
      <Field label="FOV">
        <input
          type="number"
          min={20}
          max={90}
          value={v.fov ?? 45}
          onChange={(e) => onChange({ ...v, fov: Number(e.target.value) })}
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Office page
// ---------------------------------------------------------------------------

const KEY_TITLES: Record<EditableKey, string> = {
  "office.theme": "Theme",
  "office.rooms": "Rooms",
  "office.workstations": "Workstations",
  "office.assignments": "Desk assignments",
  "office.visibility": "Visibility",
  "office.camera": "Camera defaults",
};

const KEY_NOTES: Partial<Record<EditableKey, string>> = {
  "office.workstations":
    "Positions are [x, z] floor coordinates in scene units. Drag-and-drop placement is a future extension — v1 is config-based.",
};

export function OfficePage() {
  const configRes = useResource(getConfig);
  const workersRes = useResource(listWorkers);
  const [drafts, setDrafts] = useState<Partial<Record<EditableKey, unknown>>>({});
  const [errors, setErrors] = useState<Partial<Record<EditableKey, string>>>({});
  const [saving, setSaving] = useState<EditableKey | null>(null);

  const config = configRes.data?.config ?? {};
  const workers = workersRes.data?.workers ?? [];
  const workstations: WorkstationConfig[] = Array.isArray(config["office.workstations"])
    ? (config["office.workstations"] as WorkstationConfig[])
    : [];

  const valueFor = (key: EditableKey): unknown =>
    key in drafts ? drafts[key] : config[key];

  const save = async (key: EditableKey) => {
    const schema = OFFICE_CONFIG_SCHEMAS[key];
    const parsed = schema.safeParse(valueFor(key));
    if (!parsed.success) {
      setErrors((e) => ({
        ...e,
        [key]: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      }));
      return;
    }
    setErrors((e) => ({ ...e, [key]: undefined }));
    setSaving(key);
    try {
      await putConfigKey(key, parsed.data);
      toast("Saved — public scene updates live", "ok");
      setDrafts((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      configRes.refresh();
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [key]: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setSaving(null);
    }
  };

  const renderEditor = (key: EditableKey) => {
    const value = valueFor(key);
    const onChange = (v: unknown) => setDrafts((d) => ({ ...d, [key]: v }));
    switch (key) {
      case "office.theme":
        return <ThemeEditor value={value} onChange={onChange} />;
      case "office.rooms":
        return <RoomsEditor value={value} onChange={onChange} />;
      case "office.workstations":
        return <WorkstationsEditor value={value} onChange={onChange} />;
      case "office.assignments":
        return (
          <AssignmentsEditor
            value={value}
            onChange={onChange}
            workers={workers.filter((w) => !w.archived)}
            workstations={workstations}
          />
        );
      case "office.visibility":
        return <VisibilityEditor value={value} onChange={onChange} />;
      case "office.camera":
        return <CameraEditor value={value} onChange={onChange} />;
    }
  };

  return (
    <div className="admin-page">
      <PageHeader
        title="Office"
        sub="Public office configuration. Branding lives on the Branding page. Changes broadcast live to connected dashboards."
      />
      {configRes.loading ? (
        <p className="muted">Loading…</p>
      ) : configRes.error ? (
        <p className="error-text" role="alert">
          {configRes.error}
        </p>
      ) : EDITABLE_KEYS.length === 0 ? (
        <Empty text="No editable config keys." />
      ) : (
        EDITABLE_KEYS.map((key) => (
          <ConfigSection
            key={key}
            title={`${KEY_TITLES[key]} `}
            note={KEY_NOTES[key]}
            onSave={() => save(key)}
            saving={saving === key}
          >
            <span className="muted small">
              <code>{key}</code>
            </span>
            {renderEditor(key)}
            <FormError error={errors[key] ?? null} />
          </ConfigSection>
        ))
      )}
    </div>
  );
}
