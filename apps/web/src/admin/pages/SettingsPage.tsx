import { useEffect, useState } from "react";
import {
  DEFAULT_SITE_CONFIG,
  SiteConfigSchema,
  type SiteConfig,
} from "@virtual-ai-office/shared";
import {
  ApiError,
  getReceptionistKeyStatus,
  getSiteConfig,
  postReceptionistKey,
  postSiteConfig,
} from "../api";
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
  // Receptionist API key: the value is NEVER displayed or prefilled —
  // the panel only ever learns whether one is stored.
  const [keyInput, setKeyInput] = useState("");
  const [keyStatus, setKeyStatus] = useState<boolean | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const refreshKeyStatus = async (t: string) => {
    if (!t.trim()) {
      setKeyStatus(null);
      return;
    }
    try {
      const { hasKey } = await getReceptionistKeyStatus(t.trim());
      setKeyStatus(hasKey);
    } catch {
      // Token wrong or Worker unreachable: leave status unknown; the
      // save path below surfaces token errors when the user acts.
      setKeyStatus(null);
    }
  };

  useEffect(() => {
    let storedToken = "";
    try {
      storedToken = window.sessionStorage.getItem(TOKEN_KEY) ?? "";
      setToken(storedToken);
    } catch {
      setToken("");
    }
    if (storedToken) void refreshKeyStatus(storedToken);
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

  const saveKey = async () => {
    setKeyError(null);
    if (!token.trim()) {
      setKeyError("Masukkan token admin dulu untuk menyimpan kunci.");
      return;
    }
    // Saving an empty field must NEVER overwrite: only explicit Hapus
    // clears. The button is disabled when empty; this is the backstop.
    if (!keyInput.trim()) return;
    setKeyBusy(true);
    try {
      const { hasKey } = await postReceptionistKey(keyInput, token.trim());
      setKeyStatus(hasKey);
      setKeyInput("");
      toast("Kunci API resepsionis disimpan", "ok");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setKeyError("Token ditolak — periksa kembali token admin.");
      } else if (err instanceof ApiError && err.status === 503) {
        setKeyError("Worker belum diset AGENT_SECRET — simpan belum bisa jalan.");
      } else {
        setKeyError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setKeyBusy(false);
    }
  };

  const clearKey = async () => {
    setKeyError(null);
    if (!token.trim()) {
      setKeyError("Masukkan token admin dulu untuk menghapus kunci.");
      return;
    }
    setKeyBusy(true);
    try {
      const { hasKey } = await postReceptionistKey("", token.trim());
      setKeyStatus(hasKey);
      setKeyInput("");
      toast("Kunci API resepsionis dihapus", "ok");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setKeyError("Token ditolak — periksa kembali token admin.");
      } else {
        setKeyError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setKeyBusy(false);
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
            <Field
              label="Kunci API resepsionis (opsional)"
              hint="Tidak pernah ditampilkan dan tidak bisa dilihat lagi setelah disimpan. Kolom kosong berarti jangan ubah — hanya tombol Hapus yang menghapus."
            >
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Tempel kunci API baru…"
                autoComplete="off"
              />
            </Field>
            {keyError && (
              <p className="error-text" role="alert">
                {keyError}
              </p>
            )}
            <p className="muted">
              Status kunci:{" "}
              {keyStatus === null
                ? "belum diketahui (masukkan token admin)"
                : keyStatus
                  ? "Kunci tersimpan."
                  : "Belum ada kunci."}
            </p>
            <div className="admin-form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveKey}
                disabled={keyBusy || !token.trim() || !keyInput.trim()}
              >
                {keyBusy ? "Saving…" : "Simpan kunci"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={clearKey}
                disabled={keyBusy || !token.trim() || keyStatus !== true}
              >
                Hapus kunci
              </button>
            </div>
            <p className="muted">
              Mengubah kolom resepsionis di atas tidak butuh redeploy —
              berlaku langsung setelah disimpan. Kunci API disimpan hanya
              di sisi server (Worker) dan tidak pernah dikirim ke browser:
              halaman ini hanya tahu ada atau tidak, bukan nilainya.
              Secret CLI{" "}
              <code>RECEPTIONIST_API_KEY</code> tetap berfungsi sebagai
              cadangan bila di sini belum ada kunci.
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
                onBlur={() => {
                  if (token.trim()) void refreshKeyStatus(token.trim());
                }}
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
