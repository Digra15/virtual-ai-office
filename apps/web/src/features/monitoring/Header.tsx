import { ConnectionBadge } from "./ConnectionBadge";
import { DemoBadge } from "./DemoBadge";
import { useOfficeConfigStore } from "../../stores/useOfficeConfigStore";
import { useSiteConfigStore } from "../../stores/useSiteConfigStore";

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenKanban: () => void;
  onOpenMeetings: () => void;
  onOpenSpawn: () => void;
}

/**
 * Top bar: title, demo/connection badges, command-control actions.
 * The office name comes from the runtime site settings when set, then
 * from the public branding config, then from the built-in default.
 * A saved announcement renders as a banner under the brand block.
 */
export function Header({
  onOpenSettings,
  onOpenKanban,
  onOpenMeetings,
  onOpenSpawn,
}: HeaderProps) {
  const branding = useOfficeConfigStore((s) => s.branding);
  const siteConfig = useSiteConfigStore((s) => s.config);
  const officeName =
    siteConfig?.officeName ?? branding?.officeName ?? "Virtual AI Office";
  const announcement = siteConfig?.announcement?.trim() ?? "";
  return (
    <header className="app-header">
      <div className="brand">
        <h1>{officeName}</h1>
        <p>{branding?.tagline ?? "Mission Control"}</p>
        {announcement && (
          <p className="app-announcement">{announcement}</p>
        )}
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
