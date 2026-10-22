/**
 * Admin live-update channel. Opens the backend WebSocket (when configured)
 * with no-op data handlers plus the admin broadcast callbacks; every
 * config.update / workers.update / services.update broadcast bumps a
 * counter so list pages refetch automatically.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { connectSocket } from "../services/socket";
import { backendEnv } from "../env";

const LiveContext = createContext<number>(0);

export function AdminLiveProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!backendEnv.configured || !backendEnv.wsUrl) return;
    const bump = () => setTick((t) => t + 1);
    const disconnect = connectSocket({
      wsUrl: backendEnv.wsUrl,
      onSnapshot: () => {},
      onUpdate: () => {},
      onEvent: () => {},
      onHeartbeat: () => {},
      onStatus: () => {},
      onConfigUpdate: bump,
      onWorkersUpdate: bump,
      onServicesUpdate: bump,
    });
    return disconnect;
  }, []);

  return <LiveContext.Provider value={tick}>{children}</LiveContext.Provider>;
}

/** Broadcast counter — increments whenever the Worker broadcasts an admin update. */
export function useLiveTick(): number {
  return useContext(LiveContext);
}
