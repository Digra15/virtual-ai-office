import { create } from "zustand";
import { persist } from "zustand/middleware";
import { backendEnv } from "../env";

interface SettingsState {
  apiUrl: string;
  wsUrl: string;
  stressMode: boolean;
  /** Bumped to force the socket effect to tear down and reconnect. */
  reconnectToken: number;
  setApiUrl: (v: string) => void;
  setWsUrl: (v: string) => void;
  toggleStressMode: () => void;
  reconnect: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiUrl: backendEnv.apiUrl,
      wsUrl: backendEnv.wsUrl,
      stressMode: false,
      reconnectToken: 0,
      setApiUrl: (apiUrl) => set({ apiUrl }),
      setWsUrl: (wsUrl) => set({ wsUrl }),
      toggleStressMode: () => set((s) => ({ stressMode: !s.stressMode })),
      reconnect: () => set((s) => ({ reconnectToken: s.reconnectToken + 1 })),
    }),
    {
      // Persist key bumped from "vao-settings": the old key stored the
      // workers.dev URLs, which the user's network blocks; a fresh key
      // forces the new api.zythera.ai.id defaults from env.ts.
      name: "vao-settings-v2",
      // reconnectToken is intentionally not persisted.
      partialize: (s) => ({
        apiUrl: s.apiUrl,
        wsUrl: s.wsUrl,
        stressMode: s.stressMode,
      }),
    },
  ),
);
