import { useEffect, useState } from "react";
import { backendEnv } from "../../env";
import { fetchAgents } from "../../services/api";
import { useAgentStore } from "../../stores/useAgentStore";
import { useTaskStore } from "../../stores/useTaskStore";

/**
 * Mission pages in /admin render without the dashboard's WebSocket loop,
 * so the shared agent store would stay empty. Load the live roster once
 * via the public REST endpoint and seed the local task board from it.
 * No-op when the store already holds agents or no backend is configured.
 */
export function useMissionAgents() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Object.keys(useAgentStore.getState().agents).length > 0) return;
    if (!backendEnv.configured || !backendEnv.apiUrl) return;
    let cancelled = false;
    fetchAgents(backendEnv.apiUrl)
      .then((agents) => {
        if (cancelled) return;
        useAgentStore.getState().applySnapshot(agents);
        useTaskStore.getState().seedFromAgents();
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { error };
}
