import { useState } from "react";
import { SettingsPanel } from "../../features/monitoring/SettingsPanel";
import { PageHeader } from "../ui";

/**
 * Mission control — dashboard connection settings, moved from the main
 * dashboard. These URLs are stored per browser and shared with the
 * dashboard tab on the same origin: changing them here reconnects the
 * 3D dashboard too. This is separate from Pengaturan runtime (Worker
 * site config) — that section is untouched.
 */
export function MissionConnectionPage() {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <PageHeader
        title="Koneksi"
        sub="URL backend dashboard (REST + WebSocket) dan stress mode — dipindah dari dashboard utama."
      />
      {open ? (
        <SettingsPanel open={open} onClose={() => setOpen(false)} />
      ) : (
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          Buka pengaturan koneksi
        </button>
      )}
    </div>
  );
}
