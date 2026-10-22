import { useState } from "react";
import {
  ASSET_UPLOAD_LIMITS,
  type AssetManifestEntry,
} from "@virtual-ai-office/shared";
import { deleteAsset, listAssets, uploadAsset } from "../api";
import { useResource } from "../useResource";
import {
  ConfirmDialog,
  Empty,
  Field,
  FormError,
  PageHeader,
  toast,
} from "../ui";

const MAX_BYTES = ASSET_UPLOAD_LIMITS.maxBytes;
const ALLOWED_EXT = ASSET_UPLOAD_LIMITS.allowedExt as readonly string[];

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/** Client-side validation mirroring the server's upload limits (UX only). */
export function validateAssetFile(file: File): string | null {
  if (file.size > MAX_BYTES) {
    return `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_BYTES / 1024 / 1024} MB.`;
  }
  if (!ALLOWED_EXT.includes(extOf(file.name))) {
    return `Extension "${extOf(file.name) || "(none)"}" not allowed — use ${ALLOWED_EXT.join(", ")}.`;
  }
  return null;
}

function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [id, setId] = useState("");
  const [attribution, setAttribution] = useState("");
  const [license, setLicense] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const submit = async () => {
    setError(null);
    if (!file) {
      setError("Choose a .png sprite sheet first.");
      return;
    }
    const problem = validateAssetFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    if (!id.trim()) {
      setError("An asset id is required.");
      return;
    }
    setUploading(true);
    try {
      await uploadAsset(file, {
        id: id.trim(),
        attribution: attribution.trim(),
        license: license.trim(),
      });
      toast("Asset uploaded", "ok");
      setFile(null);
      setId("");
      setAttribution("");
      setLicense("");
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-panel">
      <h3>Upload character asset</h3>
      <p className="hint">
        PNG sprite sheets (28x36 px frames, one row per animation) for the
        worker “character model” select. Max {MAX_BYTES / 1024 / 1024} MB.
        Uploaded files are served from the Worker's R2 bucket — configure the
        R2 public URL in the Worker before uploading, or asset URLs will not
        resolve publicly.
      </p>
      <FormError error={error} />
      <Field label="File (.png sprite sheet)">
        <input
          type="file"
          accept=".png"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file && (
          <span className="hint">
            {(file.size / 1024 / 1024).toFixed(2)} MB — {file.name}
          </span>
        )}
      </Field>
      <Field label="Asset id" hint="URL-safe, e.g. pixel-mika-01.">
        <input
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="pixel-mika-01"
        />
      </Field>
      <Field label="Attribution" hint="Required by the manifest format.">
        <input
          type="text"
          value={attribution}
          onChange={(e) => setAttribution(e.target.value)}
          placeholder="Artist name"
        />
      </Field>
      <Field label="License" hint="e.g. CC0-1.0.">
        <input
          type="text"
          value={license}
          onChange={(e) => setLicense(e.target.value)}
          placeholder="CC0-1.0"
        />
      </Field>
      <div className="admin-form-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "Upload asset"}
        </button>
      </div>
    </div>
  );
}

export function AssetsPage() {
  const assetsRes = useResource(listAssets);
  const [confirming, setConfirming] = useState<AssetManifestEntry | null>(null);
  const [busy, setBusy] = useState(false);

  const assets = assetsRes.data?.assets ?? [];

  const remove = async (a: AssetManifestEntry) => {
    setBusy(true);
    try {
      await deleteAsset(a.id);
      toast(`Asset "${a.id}" deleted`, "ok");
      assetsRes.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "err");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  return (
    <div className="admin-page">
      <PageHeader
        title="Assets"
        sub="Character sprite-sheet manifest (PNG) used by the worker character-model select."
      />
      <UploadForm onUploaded={assetsRes.refresh} />
      <div className="admin-panel" style={{ marginTop: 16 }}>
        <h3>Manifest</h3>
        {assetsRes.loading ? (
          <p className="muted">Loading…</p>
        ) : assetsRes.error ? (
          <p className="error-text" role="alert">
            {assetsRes.error}
          </p>
        ) : assets.length === 0 ? (
          <Empty text="No assets uploaded. The built-in procedural pixel sprite is always available." />
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>id</th>
                <th>kind</th>
                <th>attribution</th>
                <th>license</th>
                <th>supports</th>
                <th>animations</th>
                <th>url</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td>
                    <code>{a.id}</code>
                  </td>
                  <td>{a.kind}</td>
                  <td>{a.attribution || "—"}</td>
                  <td>{a.license || "—"}</td>
                  <td className="muted small">
                    {Object.entries(a.supports)
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join(", ") || "none"}
                  </td>
                  <td className="muted small">
                    {Object.entries(a.animations).map(([k, v]) => `${k}×${v}`).join(", ") || "—"}
                  </td>
                  <td>
                    <a href={a.url} target="_blank" rel="noreferrer">
                      open
                    </a>
                  </td>
                  <td className="admin-row-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setConfirming(a)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {confirming && (
        <ConfirmDialog
          title="Delete asset?"
          body={
            <p>
              Asset <code>{confirming.id}</code> will be removed from the
              manifest. Workers using it will lose their model reference.
            </p>
          }
          confirmLabel="Delete asset"
          busy={busy}
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
