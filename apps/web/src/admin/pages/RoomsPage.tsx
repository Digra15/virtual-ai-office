/**
 * Rooms admin page: the building's room list with editable names and
 * descriptions, persisted to the `office.rooms` office-config key.
 *
 * The floor plan itself (geometry, types, floors) stays the source of
 * truth in `world/building/floorPlan.ts`; this page only curates the
 * display metadata (name/description/visibility) that the public scene
 * can consume.
 */
import { useEffect, useState } from "react";
import {
  OFFICE_CONFIG_SCHEMAS,
  type RoomConfig,
} from "@virtual-ai-office/shared";
import { ROOMS, type RoomDef } from "../../world/building/floorPlan";
import { getConfig, putConfigKey } from "../api";
import { useResource } from "../useResource";
import { Empty, FormError, PageHeader, StatusPill, toast } from "../ui";

interface RoomDraft {
  id: string;
  name: string;
  description: string;
  visible: boolean;
}

function draftsFrom(configValue: unknown): RoomDraft[] {
  const overrides: RoomConfig[] = Array.isArray(configValue)
    ? (configValue as RoomConfig[])
    : [];
  const byId = new Map(overrides.map((o) => [o.id, o]));
  return ROOMS.map((r: RoomDef) => {
    const o = byId.get(r.id);
    return {
      id: r.id,
      name: o?.name ?? r.name,
      description: o?.description ?? r.description,
      visible: o?.visible ?? true,
    };
  });
}

const TYPE_TONES: Record<string, string> = {
  recovery: "warn",
  conference: "info",
  workspace: "ok",
  server: "bad",
  project: "info",
  pantry: "info",
  restroom: "info",
  reception: "ok",
  musola: "info",
};

export function RoomsPage() {
  const configRes = useResource(getConfig);
  const [drafts, setDrafts] = useState<RoomDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stored = configRes.data?.config?.["office.rooms"];

  useEffect(() => {
    if (configRes.data && drafts === null) {
      setDrafts(draftsFrom(stored));
    }
    // Initialize once from the loaded config.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configRes.data]);

  const set = (id: string, patch: Partial<RoomDraft>) =>
    setDrafts((d) => (d ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!drafts) return;
    const schema = OFFICE_CONFIG_SCHEMAS["office.rooms"];
    const parsed = schema.safeParse(
      drafts.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        visible: d.visible,
      })),
    );
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
      await putConfigKey("office.rooms", parsed.data);
      toast("Saved — room metadata updates live", "ok");
      configRes.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const roomById = new Map(ROOMS.map((r) => [r.id, r]));

  return (
    <div className="admin-page">
      <PageHeader
        title="Rooms"
        sub="Display names and descriptions for the building's rooms. Geometry stays in the floor plan — this page curates what visitors see."
      />
      {configRes.loading || drafts === null ? (
        <p className="muted">Loading…</p>
      ) : configRes.error ? (
        <p className="error-text" role="alert">
          {configRes.error}
        </p>
      ) : drafts.length === 0 ? (
        <Empty text="No rooms defined in the floor plan." />
      ) : (
        <div className="admin-panel">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Type</th>
                <th>Floor</th>
                <th>Description</th>
                <th>Visible</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => {
                const def = roomById.get(d.id);
                return (
                  <tr key={d.id}>
                    <td>
                      <input
                        type="text"
                        value={d.name}
                        onChange={(e) => set(d.id, { name: e.target.value })}
                        aria-label={`Name for room ${d.id}`}
                        style={{ width: "100%" }}
                      />
                      <div className="muted small">
                        <code>{d.id}</code>
                      </div>
                    </td>
                    <td>
                      <StatusPill
                        text={def?.type ?? "—"}
                        tone={TYPE_TONES[def?.type ?? ""]}
                      />
                    </td>
                    <td>
                      <StatusPill
                        text={def?.floor === 1 ? "Second" : "Ground"}
                        tone="info"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={d.description}
                        onChange={(e) =>
                          set(d.id, { description: e.target.value })
                        }
                        aria-label={`Description for room ${d.id}`}
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={d.visible}
                        onChange={(e) => set(d.id, { visible: e.target.checked })}
                        aria-label={`Visible: room ${d.id}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <FormError error={error} />
          <div className="admin-form-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save room metadata"}
            </button>
          </div>
          <p className="hint">
            Persisted to the <code>office.rooms</code> config key.
          </p>
        </div>
      )}
    </div>
  );
}
