import { ConnectionBadge } from "./ConnectionBadge";
import { DemoBadge } from "./DemoBadge";
import { useOfficeConfigStore } from "../../stores/useOfficeConfigStore";
import { useSiteConfigStore } from "../../stores/useSiteConfigStore";

/**
 * Top bar: title, demo/connection badges.
 * The office name comes from the runtime site settings when set, then
 * from the public branding config, then from the built-in default.
 * A saved announcement renders as a banner under the brand block.
 * Mission control actions (Board, Meet, Spawn, Settings) live in
 * /admin now; this header is a pure status bar.
 */
export function Header() {
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
        <a className="header-action" href="/admin" target="_self">
          🛠️ Admin
        </a>
      </div>
    </header>
  );
}
