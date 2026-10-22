import { ConnectionBadge } from "./ConnectionBadge";
import { DemoBadge } from "./DemoBadge";

interface HeaderProps {
  onOpenSettings: () => void;
}

/** Top bar: title, demo/connection badges, settings button. */
export function Header({ onOpenSettings }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <h1>Virtual AI Office</h1>
        <p>Mission Control</p>
      </div>
      <div className="header-right">
        <DemoBadge />
        <ConnectionBadge />
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
