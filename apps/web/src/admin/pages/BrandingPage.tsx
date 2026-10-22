import { useState } from "react";
import { BrandingConfigSchema } from "@virtual-ai-office/shared";
import { getConfig, putConfigKey } from "../api";
import { useResource } from "../useResource";
import { Field, FormError, PageHeader, toast } from "../ui";

export function BrandingPage() {
  const configRes = useResource(getConfig);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stored =
    configRes.data?.config?.["office.branding"] &&
    typeof configRes.data.config["office.branding"] === "object"
      ? (configRes.data.config["office.branding"] as Record<string, unknown>)
      : {};
  const value = draft ?? stored;

  const str = (k: string, fallback = "") =>
    typeof value[k] === "string" ? (value[k] as string) : fallback;
  const set = (k: string, v: string) => setDraft({ ...value, [k]: v });

  const save = async () => {
    setError(null);
    const parsed = BrandingConfigSchema.safeParse(value);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      );
      return;
    }
    setSaving(true);
    try {
      await putConfigKey("office.branding", parsed.data);
      toast("Saved — public scene updates live", "ok");
      setDraft(null);
      configRes.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <PageHeader
        title="Branding"
        sub="Office identity shown on the public dashboard header."
      />
      {configRes.loading ? (
        <p className="muted">Loading…</p>
      ) : configRes.error ? (
        <p className="error-text" role="alert">
          {configRes.error}
        </p>
      ) : (
        <div className="admin-grid-2">
          <div className="admin-panel">
            <FormError error={error} />
            <Field label="Office name">
              <input
                type="text"
                value={str("officeName", "Virtual AI Office")}
                onChange={(e) => set("officeName", e.target.value)}
              />
            </Field>
            <Field label="Tagline">
              <input
                type="text"
                value={str("tagline", "")}
                onChange={(e) => set("tagline", e.target.value)}
              />
            </Field>
            <Field label="Logo URL" hint="Leave empty for no logo.">
              <input
                type="text"
                value={str("logoUrl", "")}
                onChange={(e) => set("logoUrl", e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="Primary color">
              <input
                type="color"
                value={str("primaryColor", "#38bdf8")}
                onChange={(e) => set("primaryColor", e.target.value)}
              />
            </Field>
            <Field label="Accent color">
              <input
                type="color"
                value={str("accentColor", "#818cf8")}
                onChange={(e) => set("accentColor", e.target.value)}
              />
            </Field>
            <div className="admin-form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={save}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save branding"}
              </button>
            </div>
          </div>
          <div className="admin-panel">
            <h3>Live preview</h3>
            <div
              className="admin-brand-preview"
              style={{
                borderTop: `3px solid ${str("primaryColor", "#38bdf8")}`,
              }}
            >
              {str("logoUrl") && (
                <img
                  src={str("logoUrl")}
                  alt="Office logo"
                  className="admin-brand-logo"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <h2>{str("officeName", "Virtual AI Office") || "Virtual AI Office"}</h2>
              <p className="muted">{str("tagline")}</p>
              <div className="admin-swatch-row">
                <span
                  className="admin-swatch"
                  style={{ background: str("primaryColor", "#38bdf8") }}
                  title="Primary"
                />
                <span
                  className="admin-swatch"
                  style={{ background: str("accentColor", "#818cf8") }}
                  title="Accent"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
