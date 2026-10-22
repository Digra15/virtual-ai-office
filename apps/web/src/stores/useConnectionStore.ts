import { create } from "zustand";

export type ConnectionStatus = "connecting" | "live" | "demo-local" | "error";

interface ConnectionState {
  status: ConnectionStatus;
  /** True when the backend (or the local fallback) is serving simulated data. */
  demoMode: boolean;
  lastHeartbeat: string | null;
  set: (patch: Partial<Omit<ConnectionState, "set">>) => void;
}

export const useConnectionStore = create<ConnectionState>()((set) => ({
  status: "connecting",
  demoMode: false,
  lastHeartbeat: null,
  set: (patch) => set(patch),
}));
