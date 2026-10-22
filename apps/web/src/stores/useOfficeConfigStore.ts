/**
 * Public office configuration store.
 *
 * Fetches the no-auth public API (/api/public/config, /api/public/workers)
 * and applies it to the scene:
 * - branding → dashboard header (office name / tagline)
 * - worker characterConfig → character preset overrides (via
 *   setCharacterPresetOverride, so AgentAvatar picks them up automatically)
 * - worker visibility → hidden agent ids (agents without a worker record
 *   stay visible; non-public workers are excluded server-side, so a
 *   publicVisible flag is only honored if the payload carries one)
 *
 * Inactive when no backend is configured: `loaded` stays false and every
 * selector falls back to the local defaults (demo mode unchanged).
 */
import { create } from "zustand";
import {
  BrandingConfigSchema,
  CameraDefaultsSchema,
  PublicWorkerSchema,
  type BrandingConfig,
  type CameraDefaults,
  type PublicWorker,
  type ThemePreset,
} from "@virtual-ai-office/shared";
import { validateCharacterPreset } from "../world/characters/characterTypes";
import {
  clearCharacterPresetOverride,
  setCharacterPresetOverride,
} from "../world/characters/characterPresets";

/** Defensive parse of the public config payload (unknown shape). */
export function parsePublicConfig(raw: unknown): {
  branding: BrandingConfig | null;
  theme: ThemePreset | null;
  visibility: { publicScene: boolean; showOffline: boolean } | null;
  camera: CameraDefaults | null;
} {
  const empty = { branding: null, theme: null, visibility: null, camera: null };
  if (typeof raw !== "object" || raw === null) return empty;
  const c = raw as Record<string, unknown>;
  const branding = BrandingConfigSchema.safeParse(c.branding);
  const camera = CameraDefaultsSchema.safeParse(c.camera);
  const theme =
    typeof c.theme === "string" && c.theme ? (c.theme as ThemePreset) : null;
  let visibility: { publicScene: boolean; showOffline: boolean } | null = null;
  if (c.visibility && typeof c.visibility === "object") {
    const v = c.visibility as Record<string, unknown>;
    visibility = {
      publicScene: v.publicScene !== false,
      showOffline: v.showOffline !== false,
    };
  }
  return {
    branding: branding.success ? branding.data : null,
    theme,
    visibility,
    camera: camera.success ? camera.data : null,
  };
}

/** Defensive parse: the workers payload may be a bare array or {workers}. */
export function parsePublicWorkers(raw: unknown): PublicWorker[] {
  const arr = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && raw !== null && Array.isArray((raw as { workers?: unknown }).workers)
      ? (raw as { workers: unknown[] }).workers
      : [];
  const out: PublicWorker[] = [];
  for (const item of arr) {
    const parsed = PublicWorkerSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** Ids of agents whose worker record is marked non-public. */
export function computeHiddenWorkerIds(
  workers: Array<{ id: string; publicVisible?: unknown }>,
): string[] {
  return workers
    .filter((w) => w.publicVisible === false)
    .map((w) => w.id);
}

interface OfficeConfigState {
  branding: BrandingConfig | null;
  theme: ThemePreset | null;
  visibility: { publicScene: boolean; showOffline: boolean } | null;
  camera: CameraDefaults | null;
  workers: PublicWorker[];
  /** Agent ids hidden because their worker record is non-public. */
  hiddenWorkerIds: string[];
  loaded: boolean;
  error: string | null;
  fetchPublic: (apiUrl: string) => Promise<void>;
  applyOverrides: () => void;
}

// Worker ids we previously applied a preset override for, so stale ones
// can be cleared on re-apply.
let appliedOverrideIds = new Set<string>();

export const useOfficeConfigStore = create<OfficeConfigState>()((set, get) => ({
  branding: null,
  theme: null,
  visibility: null,
  camera: null,
  workers: [],
  hiddenWorkerIds: [],
  loaded: false,
  error: null,

  fetchPublic: async (apiUrl: string) => {
    try {
      const [configRes, workersRes] = await Promise.all([
        fetch(`${apiUrl}/api/public/config`, { credentials: "include" }),
        fetch(`${apiUrl}/api/public/workers`, { credentials: "include" }),
      ]);

      let branding: BrandingConfig | null = null;
      let theme: ThemePreset | null = null;
      let visibility: { publicScene: boolean; showOffline: boolean } | null =
        null;
      let camera: CameraDefaults | null = null;
      let workers: PublicWorker[] = [];

      if (configRes.ok) {
        const parsed = parsePublicConfig(await configRes.json());
        branding = parsed.branding;
        theme = parsed.theme;
        visibility = parsed.visibility;
        camera = parsed.camera;
      }
      if (workersRes.ok) {
        workers = parsePublicWorkers(await workersRes.json());
      }

      const hiddenWorkerIds = computeHiddenWorkerIds(
        workers as Array<{ id: string; publicVisible?: unknown }>,
      );

      set({
        branding,
        theme,
        visibility,
        camera,
        workers,
        hiddenWorkerIds,
        loaded: true,
        error: null,
      });
      get().applyOverrides();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        loaded: false,
      });
    }
  },

  applyOverrides: () => {
    const { workers } = get();
    const nextApplied = new Set<string>();
    for (const w of workers) {
      const record = (w.characterConfig ?? {}) as Record<string, unknown>;
      const problems = validateCharacterPreset({ ...record, agentId: w.id });
      if (problems.length === 0) {
        setCharacterPresetOverride(w.id, {
          ...(record as object),
          agentId: w.id,
        } as Parameters<typeof setCharacterPresetOverride>[1]);
        nextApplied.add(w.id);
      }
    }
    // Clear overrides for workers that no longer carry a valid config.
    for (const id of appliedOverrideIds) {
      if (!nextApplied.has(id)) clearCharacterPresetOverride(id);
    }
    appliedOverrideIds = nextApplied;
  },
}));
