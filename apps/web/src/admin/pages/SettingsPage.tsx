import { useEffect, useState } from "react";
import {
  DEFAULT_SITE_CONFIG,
  SiteConfigSchema,
  type SiteConfig,
} from "@virtual-ai-office/shared";
import { ApiError, getSiteConfig, postSiteConfig } from "../api";
import { Field, FormError, PageHeader, toast } from "../ui";

/**
 * Runtime site settings (DO storage — no D1 needed, so this page works
 * before the full admin backend lands).
 *
 * Read is public; save requires the agent bearer secret (interim auth
 * until the admin session auth replaces it). The token lives ONLY in this
 * tab's sessionStorage: it survives reloads in the same tab, vanishes when
 * the tab closes, and is never written to localStorage, a file, or chat.
 * Without a token the form still loads and displays the current values.
 */
const TOKEN_KEY = "vao-admin-token";

export function SettingsPage() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [draft, setDraft] = useState<SiteConfig>({ ...DEFAULT_SITE_CONFIG });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    try {
      setToken(window.sessionStorage.getItem(TOKEN_KEY) ?? "");
    } catch {
      setToken("");
    }
    let cancelled = false;
    getSiteConfig()
      .then(({ config: c }) => {
        if (cancelled) return;
        setConfig(c);
        setDraft(c);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setTokenStored = (v: string) => {
    setToken(v);
    try {
      if (v) window.sessionStorage.setItem(TOKEN_KEY, v);
      else window.sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* sessionStorage unavailable — token lives in state only */
    }
  };

  const forgetToken = () => setTokenStored("");

  const save = async () => {
    setError(null);
    const parsed = SiteConfigSchema.safeParse(draft);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      );
      return;
    }
    if (!token.trim()) {
      setError("Masukkan token admin dulu (AGENT_SECRET) untuk menyimpan.");
      return;
    }
    setSaving(true);
    try {
      const { config: saved } = await postSiteConfig(parsed.data, token.trim());
      setConfig(saved);
      setDraft(saved);
      toast("Pengaturan disimpan", "ok");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("Token ditolak — periksa kembali token admin.");
      } else if (err instanceof ApiError && err.status === 503) {
        setError("Worker belum diset AGENT_SECRET — simpan belum bisa jalan.");
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const minutes = Math.round(draft.offlineTimeoutMs / 60_000);
  const setMinutes = (m: number) => {
    const clamped = Math.min(60, Math.max(1, Math.round(m) || 1));
    setDraft({ ...draft, offlineTimeoutMs: clamped * 60_000 });
  };

  return (
    <div className="admin-page">
      <PageHeader
        title="Pengaturan"
        sub="Pengaturan runtime kantor — tersimpan di Worker, berlaku tanpa rebuild. Halaman dashboard yang sudah terbuka memuat nilai baru saat reload."
      />
      {loading ? (
        <p className="muted">Loading…</p>
      ) : loadError ? (
        <p className="error-text" role="alert">
          {loadError}
        </p>
      ) : (
        <div className="admin-grid-2">
          <div className="admin-panel">
            <FormError error={error} />
            <Field label="Nama kantor">
              <input
                type="text"
                value={draft.officeName}
                onChange={(e) =>
                  setDraft({ ...draft, officeName: e.target.value })
                }
              />
            </Field>
            <Field
              label="Pengumuman"
              hint="Kosong = tidak ada banner. Tampil di bawah nama kantor di dashboard."
            >
              <textarea
                value={draft.announcement}
                onChange={(e) =>
                  setDraft({ ...draft, announcement: e.target.value })
                }
                rows={3}
              />
            </Field>
            <Field
              label="Timeout offline (menit)"
              hint="Kursi tanpa laporan lebih lama dari ini tampil offline. 10 menit disarankan untuk poller 5 menit."
            >
              <input
                type="number"
                min={1}
                max={60}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </Field>
            <Field
              label="URL endpoint resepsionis AI"
              hint="Kosong = resepsionis AI nonaktif, pesan tamu dijawab poller. Berlaku langsung tanpa redeploy."
            >
              <input
                type="text"
                value={draft.receptionistApiUrl}
                onChange={(e) =>
                  setDraft({ ...draft, receptionistApiUrl: e.target.value })
                }
                placeholder="https://…/v1/chat/completions"
                autoComplete="off"
              />
            </Field>
            <Field
              label="Format endpoint"
              hint="openai untuk endpoint OpenAI-compatible; nilai lain menonaktifkan pemanggilan."
            >
              <input
                type="text"
                value={draft.receptionistApiFormat}
                onChange={(e) =>
                  setDraft({ ...draft, receptionistApiFormat: e.target.value })
                }
                placeholder="openai"
                autoComplete="off"
              />
            </Field>
            <Field
              label="Model resepsionis (opsional)"
              hint="Kosong = nama model tidak dikirim ke endpoint (sebagian endpoint tidak membutuhkannya)."
            >
              <input
                type="text"
                value={draft.receptionistModel}
                onChange={(e) =>
                  setDraft({ ...draft, receptionistModel: e.target.value })
                }
                autoComplete="off"
              />
            </Field>
            <p className="muted">
              Mengubah tiga kolom resepsionis di atas tidak butuh redeploy
              — berlaku langsung setelah disimpan. Kunci API, bila
              endpoint membutuhkannya, tetap diset sekali lewat{" "}
              <code>npx wrangler secret put RECEPTIONIST_API_KEY</code>{" "}
              dari apps/worker, dan tidak pernah ditampilkan atau disimpan
              di sini.
            </p>
            <div className="admin-form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={save}
                disabled={saving}
              >
                {saving ? "Saving…" : "Simpan pengaturan"}
              </button>
            </div>
          </div>
          <div className="admin-panel">
            <h3>Token admin</h3>
            <p className="muted">
              Menyimpan butuh token admin (AGENT_SECRET yang sama dengan
              yang dipakai Worker). Token hanya disimpan di tab ini dan
              hilang saat tab ditutup. Membaca pengaturan tidak butuh token.
            </p>
            <Field label="Token admin">
              <input
                type="password"
                value={token}
                onChange={(e) => setTokenStored(e.target.value)}
                placeholder="Tempel token admin…"
                autoComplete="off"
              />
            </Field>
            <div className="admin-form-actions">
              <button
                type="button"
                className="btn"
                onClick={forgetToken}
                disabled={!token}
              >
                Lupakan token
              </button>
            </div>
            {config && (
              <p className="muted">
                Nilai tersimpan saat ini: “{config.officeName}”, timeout{" "}
                {Math.round(config.offlineTimeoutMs / 60_000)} menit
                {config.announcement
                  ? `, pengumuman aktif`
                  : `, tanpa pengumuman`}
                .
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
