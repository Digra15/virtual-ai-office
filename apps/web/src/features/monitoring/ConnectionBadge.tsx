import { useConnectionStore } from "../../stores/useConnectionStore";

const LABELS: Record<string, string> = {
  connecting: "Connecting…",
  live: "Live",
  "demo-local": "Local demo",
  error: "Connection error",
};

/** WebSocket connection status dot + label. */
export function ConnectionBadge() {
  const status = useConnectionStore((s) => s.status);
  const cls =
    status === "live"
      ? "badge badge-live"
      : status === "error"
        ? "badge badge-error"
        : status === "demo-local"
          ? "badge badge-demo"
          : "badge badge-connecting";
  return (
    <span className={cls} role="status" aria-label={`Connection: ${LABELS[status]}`}>
      <span className="dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
