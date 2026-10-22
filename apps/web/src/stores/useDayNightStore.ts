import { create } from "zustand";

/**
 * Day/night cycle for the 3D office.
 *
 * `mode` is the user's choice (`auto` follows the viewer's real local
 * time: day 06:00–18:00, night otherwise). `isNight` is the *resolved*
 * value the lighting rig reads. The override persists in localStorage.
 */

export type DayNightMode = "auto" | "day" | "night";

const STORAGE_KEY = "vao-daynight-mode";

function loadMode(): DayNightMode {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "auto" || raw === "day" || raw === "night") return raw;
  } catch {
    /* storage unavailable (private mode, tests) — fall through */
  }
  return "auto";
}

function persistMode(mode: DayNightMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Pure: resolve a mode to "night?" given the viewer's local hour. */
export function resolveIsNight(mode: DayNightMode, localHour: number): boolean {
  if (mode === "day") return false;
  if (mode === "night") return true;
  return localHour < 6 || localHour >= 18;
}

/** Pure: is it night for `mode` at `now` (local time)? */
export function resolveIsNightAt(mode: DayNightMode, now: Date): boolean {
  return resolveIsNight(mode, now.getHours());
}

interface DayNightState {
  mode: DayNightMode;
  isNight: boolean;
  /** Set an override (persisted); resolves isNight immediately. */
  setMode: (mode: DayNightMode) => void;
  /** Re-resolve isNight from local time (for `auto` drift while open). */
  reResolve: (now?: Date) => void;
}

export const useDayNightStore = create<DayNightState>()((set, get) => ({
  mode: loadMode(),
  isNight: resolveIsNightAt(loadMode(), new Date()),
  setMode: (mode) => {
    persistMode(mode);
    set({ mode, isNight: resolveIsNightAt(mode, new Date()) });
  },
  reResolve: (now = new Date()) => {
    const { mode } = get();
    set({ isNight: resolveIsNightAt(mode, now) });
  },
}));
