import React, { Suspense, useEffect, useState } from "react";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { LoadingOverlay } from "./app/LoadingOverlay";
import { AssetGuard } from "./components/AssetGuard";
import { Header } from "./features/monitoring/Header";
import { StatCards } from "./features/monitoring/StatCards";
import { CameraControls } from "./features/monitoring/CameraControls";
import { SettingsPanel } from "./features/monitoring/SettingsPanel";
import { AgentList } from "./features/agents/AgentList";
import { AgentDetailPanel } from "./features/agents/AgentDetailPanel";
import { EventTimeline } from "./features/agents/EventTimeline";
import { useAgentStore } from "./stores/useAgentStore";
import { useConnectionStore } from "./stores/useConnectionStore";
import { useSettingsStore } from "./stores/useSettingsStore";
import { connectSocket } from "./services/socket";
import { buildLocalDemoAgents, buildStressAgents } from "./services/demoAgents";
import { backendEnv } from "./env";
import { KanbanBoard } from "./features/kanban/KanbanBoard";
import { MeetingPanel } from "./features/meetings/MeetingPanel";
import { SpawnPanel } from "./features/agents/SpawnPanel";
import { WanderDirector } from "./features/wander/WanderDirector";
import { useTaskStore } from "./stores/useTaskStore";

// Code-split the 3D scene: the 2D dashboard stays interactive while three.js loads.
const OfficeScene = React.lazy(() => import("./world/OfficeScene"));

const SNAPSHOT_TIMEOUT_MS = 6000;

function applyStressExtrasIfEnabled() {
  if (useSettingsStore.getState().stressMode) {
    const store = useAgentStore.getState();
    buildStressAgents(22).forEach((a) => store.upsertLocal(a));
  }
}

function fallbackToLocalDemo(reason: string) {
  console.info(`[app] using local demo data (${reason})`);
  useAgentStore.getState().applySnapshot(buildLocalDemoAgents());
  applyStressExtrasIfEnabled();
  useTaskStore.getState().seedFromAgents();
  useConnectionStore.getState().set({ status: "demo-local", demoMode: true });
}

function Dashboard() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [kanbanOpen, setKanbanOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);

  const wsUrl = useSettingsStore((s) => s.wsUrl);
  const reconnectToken = useSettingsStore((s) => s.reconnectToken);
  const stressMode = useSettingsStore((s) => s.stressMode);
  const selectedId = useAgentStore((s) => s.selectedId);
  const agents = useAgentStore((s) => s.agents);
  const select = useAgentStore((s) => s.select);

  const backendConfigured = backendEnv.configured || wsUrl.trim() !== "";

  // --- WebSocket connection lifecycle -------------------------------------
  useEffect(() => {
    const url = wsUrl.trim();
    if (!url) {
      fallbackToLocalDemo("backend not configured");
      return;
    }

    let cancelled = false;
    let gotSnapshot = false;
    const conn = useConnectionStore.getState();
    conn.set({ status: "connecting", demoMode: false, lastHeartbeat: null });

    const snapshotTimer = window.setTimeout(() => {
      if (!cancelled && !gotSnapshot) {
        fallbackToLocalDemo("no snapshot within 6s");
        // The socket keeps retrying in the background; a later snapshot
        // transparently upgrades the dashboard to live data.
      }
    }, SNAPSHOT_TIMEOUT_MS);

    const disconnect = connectSocket({
      wsUrl: url,
      onSnapshot: (snapshotAgents, demoMode) => {
        if (cancelled) return;
        gotSnapshot = true;
        window.clearTimeout(snapshotTimer);
        useAgentStore.getState().applySnapshot(snapshotAgents);
        applyStressExtrasIfEnabled();
        useTaskStore.getState().seedFromAgents();
        useConnectionStore.getState().set({
          status: "live",
          demoMode,
          lastHeartbeat: new Date().toISOString(),
        });
      },
      onUpdate: (agent) => {
        if (!cancelled) useAgentStore.getState().applyUpdate(agent);
      },
      onEvent: (agentId, entry) => {
        if (!cancelled) useAgentStore.getState().appendEvent(agentId, entry);
      },
      onHeartbeat: (serverTime, demoMode) => {
        if (cancelled) return;
        useConnectionStore.getState().set({
          status: "live",
          demoMode,
          lastHeartbeat: serverTime,
        });
      },
      onStatus: (s) => {
        if (cancelled) return;
        if (s === "live") {
          useConnectionStore.getState().set({ status: "live" });
        } else if (s === "error" && !gotSnapshot) {
          useConnectionStore.getState().set({ status: "error" });
        }
      },
    });

    return () => {
      cancelled = true;
      window.clearTimeout(snapshotTimer);
      disconnect();
    };
  }, [wsUrl, reconnectToken]);

  // --- Stress mode: 22 deterministic extra agents ---------------------------
  useEffect(() => {
    const store = useAgentStore.getState();
    const extras = buildStressAgents(22);
    if (stressMode) {
      extras.forEach((a) => store.upsertLocal(a));
    } else {
      extras.forEach((a) => store.removeLocal(a.id));
    }
  }, [stressMode]);

  const selected = selectedId ? agents[selectedId] : null;

  return (
    <div className="app">
      <WanderDirector />
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenKanban={() => setKanbanOpen(true)}
        onOpenMeetings={() => setMeetingOpen(true)}
        onOpenSpawn={() => setSpawnOpen(true)}
      />
      {!backendConfigured && (
        <div className="config-error" role="alert">
          Backend not configured — set <code>VITE_API_URL</code> /{" "}
          <code>VITE_WS_URL</code> and redeploy, or enter the URLs in Settings.
          Showing local simulated data.
        </div>
      )}
      <div className="main">
        <aside className="sidebar-left">
          <StatCards />
          <AgentList />
        </aside>
        <div className="viewport">
          <AssetGuard label="3D office scene">
            <Suspense fallback={<LoadingOverlay />}>
              <OfficeScene />
            </Suspense>
          </AssetGuard>
          <CameraControls />
          {selected && (
            <AgentDetailPanel agent={selected} onClose={() => select(null)} />
          )}
        </div>
      </div>
      <EventTimeline />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {kanbanOpen && <KanbanBoard onClose={() => setKanbanOpen(false)} />}
      {meetingOpen && <MeetingPanel onClose={() => setMeetingOpen(false)} />}
      {spawnOpen && <SpawnPanel onClose={() => setSpawnOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
