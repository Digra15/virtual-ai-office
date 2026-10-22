import { ConnectionBadge } from "./ConnectionBadge";
import { DemoBadge } from "./DemoBadge";
import { useOfficeConfigStore } from "../../stores/useOfficeConfigStore";

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenKanban: () => void;
  onOpenMeetings: () => void;
  onOpenSpawn: () => void;
}

/**
 * Top bar: title, demo/connection badges, command-control actions.
 * The office name/tagline come from the public branding config when a
 * backend is configured; otherwise the built-in defaults are used.
 */
export function Header({
  onOpenSettings,
  onOpenKanban,
  onOpenMeetings,
  onOpenSpawn,
}: HeaderProps) {
  const branding = useOfficeConfigStore((s) => s.branding);
  return (
    <header className="app-header">
      <div className="brand">
        <h1>{branding?.officeName ?? "Virtual AI Office"}</h1>
        <p>{branding?.tagline ?? "Mission Control"}</p>
      </div>
      <div className="header-right">
        <DemoBadge />
        <ConnectionBadge />
        <button
          type="button"
          className="header-action"
          onClick={onOpenKanban}
          aria-label="Open task board"
        >
          📋 Board
        </button>
        <button
          type="button"
          className="header-action"
          onClick={onOpenMeetings}
          aria-label="Open meetings"
        >
          🗣️ Meet
        </button>
        <button
          type="button"
          className="header-action"
          onClick={onOpenSpawn}
          aria-label="Spawn agent"
        >
          ➕ Spawn
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          aria-label="Open settings"
        >
          ⚙ Settings
        </button>
      </div>
    </header>
  );
}
