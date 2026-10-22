import { useState } from "react";
import type { AgentInfo } from "@virtual-ai-office/shared";
import { useAgentStore } from "../../stores/useAgentStore";
import {
  getAllPresets,
  setCharacterPresetOverride,
} from "../../world/characters/characterPresets";
import { findFreeWorkstation } from "./spawnLogic";

const SPAWN_ROLES = [
  "Personal Assistant",
  "Research Agent",
  "Coding Agent",
  "Writing Agent",
  "Design Agent",
  "Data Analyst",
  "Automation Agent",
  "Monitoring Agent",
  "QA Agent",
] as const;

/**
 * Spawn a new simulated agent: name + role + visual style → a free
 * workstation from the overflow desks. New agents are honestly labeled
 * source "Simulated" (same as the demo roster).
 */
export function SpawnPanel({ onClose }: { onClose: () => void }) {
  const agents = useAgentStore((s) => s.agents);
  const upsertLocal = useAgentStore((s) => s.upsertLocal);

  const [name, setName] = useState("");
  const [role, setRole] = useState<string>(SPAWN_ROLES[0]);
  const [style, setStyle] = useState<string>("auto");
  const [error, setError] = useState<string | null>(null);
  const [spawnedId, setSpawnedId] = useState<string | null>(null);

  const presets = getAllPresets();

  const handleSpawn = () => {
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Give the agent a name.");
      return;
    }
    const freeDesk = findFreeWorkstation(agents);
    if (!freeDesk) {
      setError(
        "No free workstation — all 22 overflow desks are occupied. Remove an agent first.",
      );
      return;
    }

    const id = `agent-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const agent: AgentInfo = {
      id,
      name: cleanName,
      role,
      status: "idle",
      currentTask: "Awaiting assignment",
      progress: null,
      lastSeen: now,
      workstationId: freeDesk,
      activityHistory: [
        {
          id: `${id}-spawn`,
          agentId: id,
          timestamp: now,
          kind: "status",
          message: `Spawned via Spawn Panel → ${freeDesk} (simulated)`,
        },
      ],
      source: "demo",
    };

    if (style !== "auto") {
      const base = presets.find((p) => p.agentId === style);
      if (base) setCharacterPresetOverride(id, base);
    }

    upsertLocal(agent);
    setSpawnedId(id);
    setName("");
    setError(null);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Spawn agent">
      <div className="modal">
        <div className="side-panel-header">
          <h2>Spawn agent</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="muted small">
          Creates a simulated agent at a free overflow desk.{" "}
          <span className="sim-badge">SIMULATED</span>
        </p>
        <label className="field">
          Name
          <input
            type="text"
            className="text-input"
            placeholder="e.g. Scout"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
          />
        </label>
        <label className="field">
          Role
          <select
            className="text-input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {SPAWN_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Visual style
          <select
            className="text-input"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          >
            <option value="auto">Auto (from name)</option>
            {presets.map((p) => (
              <option key={p.agentId} value={p.agentId}>
                Like {p.agentId} ({p.hairStyle}, {p.outfitStyle})
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {spawnedId && (
          <p className="success-text" role="status">
            Spawned! Find them at their new desk in the overflow area.
          </p>
        )}
        <button
          type="button"
          className="primary-btn"
          onClick={handleSpawn}
          disabled={!name.trim()}
        >
          Spawn agent
        </button>
      </div>
    </div>
  );
}
