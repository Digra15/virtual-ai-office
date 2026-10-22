/**
 * Recovery workflow configuration (client-side).
 *
 * Local zustand toggles for the recovery workflow. The admin console
 * persists the canonical config as the `office.recovery` office-config
 * key on the Worker; the public dashboard API only exposes a fixed subset
 * of config keys, so when that key is absent (demo mode or an
 * unconfigured backend) these local defaults apply.
 *
 * The admin Recovery page writes `office.recovery` via the admin API and
 * the RecoveryDirector picks it up through `getEffectiveRecoveryConfig()`.
 */
import { create } from "zustand";
import { useOfficeConfigStore } from "../../stores/useOfficeConfigStore";

interface RecoveryConfigState {
  /** Master switch for the whole recovery workflow. */
  enabled: boolean;
  /** When true, errored agents are walked to a free bed automatically. */
  autoRecover: boolean;
  setEnabled: (v: boolean) => void;
  setAutoRecover: (v: boolean) => void;
}

export const useRecoveryConfigStore = create<RecoveryConfigState>()((set) => ({
  enabled: true,
  autoRecover: true,
  setEnabled: (enabled) => set({ enabled }),
  setAutoRecover: (autoRecover) => set({ autoRecover }),
}));

export interface EffectiveRecoveryConfig {
  enabled: boolean;
  autoRecover: boolean;
}

/**
 * Merge the admin-managed `office.recovery` config (when the backend
 * exposes it) with the local toggles. Defensive: any missing or
 * malformed remote value falls back to the local default — the workflow
 * never breaks because a config key is absent.
 */
export function getEffectiveRecoveryConfig(): EffectiveRecoveryConfig {
  const office = useOfficeConfigStore.getState() as unknown as {
    recovery?: { enabled?: unknown; autoRecover?: unknown } | null;
  };
  const remote = office.recovery;
  const local = useRecoveryConfigStore.getState();
  return {
    enabled:
      typeof remote?.enabled === "boolean" ? remote.enabled : local.enabled,
    autoRecover:
      typeof remote?.autoRecover === "boolean"
        ? remote.autoRecover
        : local.autoRecover,
  };
}
