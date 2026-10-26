/**
 * Runtime site settings store.
 *
 * Fetches the no-auth Worker endpoint (/api/config, DO storage — no D1
 * needed) and applies it to the dashboard:
 * - officeName → dashboard header (wins over the branding config name,
 *   which comes from the deferred D1-backed public config)
 * - announcement → banner under the dashboard header (empty = hidden)
 *
 * Inactive when the fetch fails: `config` stays null and every selector
 * falls back to the previous defaults. Never blocks the dashboard.
 */
import { create } from "zustand";
import {
  SiteConfigSchema,
  type SiteConfig,
} from "@virtual-ai-office/shared";

interface SiteConfigState {
  config: SiteConfig | null;
  loaded: boolean;
  error: string | null;
  fetchSiteConfig: (apiUrl: string) => Promise<void>;
}

export const useSiteConfigStore = create<SiteConfigState>()((set) => ({
  config: null,
  loaded: false,
  error: null,

  fetchSiteConfig: async (apiUrl: string) => {
    try {
      const res = await fetch(`${apiUrl}/api/config`);
      if (!res.ok) {
        set({ error: `Site config request failed (${res.status})`, loaded: false });
        return;
      }
      const parsed = SiteConfigSchema.safeParse(
        (await res.json() as { config?: unknown }).config,
      );
      if (!parsed.success) {
        set({ error: "Site config payload failed validation", loaded: false });
        return;
      }
      set({ config: parsed.data, loaded: true, error: null });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        loaded: false,
      });
    }
  },
}));
