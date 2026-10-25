/**
 * Animated activity caption shown below an agent's name (replacing the
 * old status icon). One glance tells what the agent is actually doing:
 * "working" agents type at their desks, "thinking" and "waiting" agents
 * deliberately do not — which is why Writing (thinking) and Automation
 * (waiting) show no typing pose. Sleeping agents keep the "zZ" caption
 * exactly as before.
 *
 * Priority: lying beats everything (a recovering agent on a bed is
 * asleep even if its status still says something else), then prayer,
 * then the current activity, then the status.
 */
export interface ActivityLabelInput {
  status: string;
  activity?: string;
  prayerPose?: "bowing" | "prostrate" | "sitting" | null;
  lying?: boolean;
}

export interface ActivityLabel {
  text: string;
  color: string;
}

const STATUS_LABELS: Record<string, ActivityLabel> = {
  working: { text: "working", color: "#4ade80" },
  thinking: { text: "thinking", color: "#facc15" },
  waiting: { text: "waiting", color: "#facc15" },
  meeting: { text: "meeting", color: "#38bdf8" },
  error: { text: "error", color: "#f87171" },
  offline: { text: "offline", color: "#9ca3af" },
  idle: { text: "idle", color: "#e5e7eb" },
};

export function activityLabel(input: ActivityLabelInput): ActivityLabel {
  if (input.lying) return { text: "zZ", color: "#c084fc" };
  if (input.prayerPose) return { text: "praying", color: "#16a34a" };
  if (input.activity === "break") return { text: "eating", color: "#f59e0b" };
  if (input.activity === "pup") return { text: "pup", color: "#2dd4bf" };
  if (input.activity === "walking") return { text: "walking", color: "#38bdf8" };
  if (input.activity === "meeting") return { text: "meeting", color: "#38bdf8" };
  return STATUS_LABELS[input.status] ?? { text: "idle", color: "#e5e7eb" };
}
