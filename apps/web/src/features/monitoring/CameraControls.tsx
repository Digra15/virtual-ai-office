import { useState } from "react";
import { useAgentStore } from "../../stores/useAgentStore";
import { useBuildingViewStore } from "../../stores/useBuildingViewStore";
import { useCameraStore } from "../../stores/useCameraStore";
import { useDayNightStore, type DayNightMode } from "../../stores/useDayNightStore";
import { movement } from "../../world/movement";
import { ROOMS, type FloorMode } from "../../world/building/floorPlan";

const FLOOR_BUTTONS: { mode: FloorMode; label: string }[] = [
  { mode: "entire", label: "🏢 All" },
  { mode: "ground", label: "🟫 Ground" },
  { mode: "second", label: "🟦 Upper" },
  { mode: "outdoor", label: "🌳 Outdoor" },
];

const DAYNIGHT_BUTTONS: { mode: DayNightMode; label: string }[] = [
  { mode: "day", label: "☀️ Day" },
  { mode: "night", label: "🌙 Night" },
  { mode: "auto", label: "🔄 Auto" },
];

/**
 * Floating camera control bar over the 3D viewport (bottom-center):
 * floor-view selector, room quick-nav, and reset view. Pointer events are
 * only active on the bar itself so canvas interaction is unaffected.
 */
export function CameraControls() {
  const floorMode = useBuildingViewStore((s) => s.floorMode);
  const requestView = useCameraStore((s) => s.requestView);
  const requestRoom = useCameraStore((s) => s.requestRoom);
  const requestReset = useCameraStore((s) => s.requestReset);
  const requestFocus = useCameraStore((s) => s.requestFocus);
  const selectedId = useAgentStore((s) => s.selectedId);
  const agents = useAgentStore((s) => s.agents);
  const [roomId, setRoomId] = useState("");
  const dnMode = useDayNightStore((s) => s.mode);
  const setDnMode = useDayNightStore((s) => s.setMode);

  const focusSelected = () => {
    if (!selectedId) return;
    const agent = agents[selectedId];
    if (!agent) return;
    // Live position (the agent may be wandering), falling back to y=1.2.
    const pos = movement.getPosition3D(agent.id);
    requestFocus(agent.id, [pos?.x ?? 0, 1.2, pos?.z ?? 0]);
  };

  return (
    <div
      className="camera-controls"
      style={{
        left: "50%",
        right: "auto",
        transform: "translateX(-50%)",
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "center",
        maxWidth: "min(92%, 720px)",
        pointerEvents: "auto",
      }}
    >
      {FLOOR_BUTTONS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          className={mode === floorMode ? "btn btn-primary" : "btn"}
          onClick={() => requestView(mode)}
          aria-pressed={mode === floorMode}
          aria-label={`Show ${label} view`}
        >
          {label}
        </button>
      ))}
      {DAYNIGHT_BUTTONS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          className={mode === dnMode ? "btn btn-primary" : "btn"}
          onClick={() => setDnMode(mode)}
          aria-pressed={mode === dnMode}
          aria-label={`Set ${label} lighting`}
        >
          {label}
        </button>
      ))}
      <select
        className="btn"
        value={roomId}
        aria-label="Navigate to room"
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          requestRoom(id);
          setRoomId("");
        }}
        style={{ cursor: "pointer" }}
      >
        <option value="">📍 Go to room…</option>
        {ROOMS.map((room) => (
          <option key={room.id} value={room.id}>
            {room.name} — {room.floor === 0 ? "Ground" : "Upper"}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn"
        onClick={focusSelected}
        disabled={!selectedId}
        aria-label="Focus selected agent"
        title={selectedId ? "Focus camera on selected agent" : "Select an agent first"}
      >
        🎯 Focus
      </button>
      <button
        type="button"
        className="btn"
        onClick={requestReset}
        aria-label="Reset camera view"
      >
        ⟲ Reset View
      </button>
    </div>
  );
}
