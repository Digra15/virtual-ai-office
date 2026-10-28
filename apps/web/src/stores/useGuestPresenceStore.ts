import { create } from "zustand";
import { backendEnv } from "../env";

/**
 * Guest-presence signal for Nayla's reception standby (dashboard only).
 *
 * The Worker route GET /api/guest-chat/presence returns a bare boolean —
 * no message content, guestIds, or guest names. This store polls it and
 * derives the effective signal:
 * - Remote answer available → remote wins (it covers ALL guests, every
 *   browser, not just this tab's widget).
 * - Remote route missing (404 = old Worker without the route) → fall
 *   back to the LOCAL signal only (this browser's widget open with a
 *   recent or unanswered local thread, reported by GuestChatWidget).
 * - Transient failure (offline, 5xx) → keep the previous signal, so a
 *   network blip never yanks Nayla off the desk mid-chat.
 *
 * Fetch failures are deliberately silent: a missing route or a dropped
 * request must never spam the console or break the scene.
 *
 * Read imperatively (getState) from the directors, like the other
 * director stores — nothing subscribes, so polling never re-renders.
 *
 * BRIEFING SIGNAL (privacy rule): the Worker route
 * GET /api/guest-chat/briefing returns ONLY { briefingActive } — a
 * bare boolean, no guest ids, names, message text, or task titles.
 * It is true exactly when Difia has a pending "Guest request:" task
 * (the poller bridge's marker). The dashboard therefore learns THAT
 * a guest-order briefing is wanted, never WHAT the order says: the
 * dialogue strip for such a briefing shows a generic caption only
 * (see BriefingDirector), and the specific instruction stays in the
 * PM task, visible only to the office side. Fetching uses the same
 * silent-failure pattern as presence (404 = old Worker without the
 * route → signal off; transient failure → keep the previous value).
 */

/** How often the dashboard polls the presence route while mounted (ms). */
export const GUEST_PRESENCE_POLL_MS = 30_000;

/** Window in which a local guest message counts as recent (ms). Mirrors
 * the Worker's GUEST_PRESENCE_WINDOW_MS rule. */
export const LOCAL_GUEST_WINDOW_MS = 5 * 60_000;

interface GuestPresenceState {
  /** Last remote answer (null = not yet fetched, or route unavailable). */
  remoteActive: boolean | null;
  /** True once the route has 404'd (old Worker without the route). */
  remoteUnavailable: boolean;
  /** Local-widget signal (see GuestChatWidget). */
  localActive: boolean;
  /** Effective signal: remote when available, local fallback otherwise. */
  guestActive: boolean;
  /** Guest-order briefing wanted (Worker boolean only, no content). */
  briefingActive: boolean;
  /** True once the briefing route has 404'd (old Worker). */
  briefingUnavailable: boolean;
  setLocalActive: (active: boolean) => void;
  /** Poll the Worker presence route once; silent on failure. */
  fetchRemote: () => Promise<void>;
  /** Poll the Worker briefing-signal route once; silent on failure. */
  fetchBriefing: () => Promise<void>;
}

export const useGuestPresenceStore = create<GuestPresenceState>()(
  (set) => ({
    remoteActive: null,
    remoteUnavailable: false,
    localActive: false,
    guestActive: false,
    briefingActive: false,
    briefingUnavailable: false,

    setLocalActive: (active) =>
      set((s) => ({
        localActive: active,
        guestActive: s.remoteActive ?? active,
      })),

    fetchRemote: async () => {
      let res: Response;
      try {
        res = await fetch(`${backendEnv.apiUrl}/api/guest-chat/presence`);
      } catch {
        // Offline / unreachable: keep the previous signal.
        return;
      }
      if (res.status === 404) {
        // Old Worker without the route: fall back to the local signal.
        set((s) => ({
          remoteActive: null,
          remoteUnavailable: true,
          guestActive: s.localActive,
        }));
        return;
      }
      if (!res.ok) {
        // Other server errors: keep the previous signal.
        return;
      }
      try {
        const data = (await res.json()) as { guestActive?: unknown };
        if (typeof data.guestActive !== "boolean") return;
        set({
          remoteActive: data.guestActive,
          remoteUnavailable: false,
          guestActive: data.guestActive,
        });
      } catch {
        // Malformed body: keep the previous signal.
        return;
      }
    },

    fetchBriefing: async () => {
      let res: Response;
      try {
        res = await fetch(`${backendEnv.apiUrl}/api/guest-chat/briefing`);
      } catch {
        // Offline / unreachable: keep the previous signal.
        return;
      }
      if (res.status === 404) {
        // Old Worker without the route: signal off, permanently.
        set({ briefingActive: false, briefingUnavailable: true });
        return;
      }
      if (!res.ok) {
        // Other server errors: keep the previous signal.
        return;
      }
      try {
        const data = (await res.json()) as { briefingActive?: unknown };
        if (typeof data.briefingActive !== "boolean") return;
        set({ briefingActive: data.briefingActive, briefingUnavailable: false });
      } catch {
        // Malformed body: keep the previous signal.
        return;
      }
    },
  }),
);
