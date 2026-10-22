import { useConnectionStore } from "../../stores/useConnectionStore";

/** Shown whenever the dashboard is rendering simulated data. */
export function DemoBadge() {
  const demoMode = useConnectionStore((s) => s.demoMode);
  if (!demoMode) return null;
  return (
    <span className="badge badge-demo" role="status">
      DEMO MODE — simulated data
    </span>
  );
}
