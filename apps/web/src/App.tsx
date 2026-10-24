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
import { useDayNightStore } from "./stores/useDayNightStore";
import { useSceneReadyStore } from "./stores/useSceneReadyStore";
import { useSettingsStore } from "./stores/useSettingsStore";
import { useOfficeConfigStore } from "./stores/useOfficeConfigStore";
import { connectSocket } from "./services/socket";
import { buildLocalDemoAgents, buildStressAgents } from "./services/demoAgents";
import { backendEnv } from "./env";
import { KanbanBoard } from "./features/kanban/KanbanBoard";
import { MeetingPanel } from "./features/meetings/MeetingPanel";
import { SpawnPanel } from "./features/agents/SpawnPanel";
import { WanderDirector } from "./features/wander/WanderDirector";
import { PrayerDirector } from "./features/prayer/PrayerDirector";
import { RecoveryDirector } from "./features/recovery/RecoveryDirector";
import { useTaskStore } from "./stores/useTaskStore";

// Code-split the 3D scene: the 2D dashboard stays interactive while three.js loads.
const OfficeScene = React.lazy(() => import("./world/OfficeScene"));

// The /admin console is a separate app, lazy-loaded so the dashboard bundle
// stays lean. Served by the SPA fallback (public/_redirects).
const AdminApp = React.lazy(() => import("./admin/AdminApp"));

const SNAPSHOT_TIMEOUT_MS = 6000;
const PUBLIC_POLL_MS = 30_000;

/**
 * Applies the public office configuration (branding, worker visibility,
 * character overrides) to the dashboard. Fetches once on mount, refetches
 * on admin WS broadcasts, and polls every 30s as a fallback while the
 * socket is not live. No-op when no backend is configured (demo mode
 * keeps behaving exactly as today).
 */
function PublicOfficeSync() {
  const status = useConnectionStore((s) => s.status);

  useEffect(() => {
    if (!backendEnv.configured) return;
    void useOfficeConfigStore.getState().fetchPublic(backendEnv.apiUrl);
  }, []);

  useEffect(() => {
    if (!backendEnv.configured || status === "live") return;
    const timer = window.setInterval(() => {
      void useOfficeConfigStore.getState().fetchPublic(backendEnv.apiUrl);
    }, PUBLIC_POLL_MS);
    return () => window.clearInterval(timer);
  }, [status]);

  return null;
}

/**
 * Keeps the day/night cycle in sync with the viewer's real local time:
 * re-resolve on mount, then every 60s (for `auto` drift while open).
 */
function DayNightSync() {
  useEffect(() => {
    useDayNightStore.getState().reResolve();
    const timer = window.setInterval(() => {
      useDayNightStore.getState().reResolve();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}

function applyStressExtrasIfEnabled() {
  if (useSettingsStore.getState().stressMode) {
    const store = useAgentStore.getState();
    buildStressAgents().forEach((a) => store.upsertLocal(a));
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
  // Honest loading gate: stays up until the Canvas has rendered a real frame.
  const sceneReady = useSceneReadyStore((s) => s.ready);

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
      // Admin live updates: refetch the public office config/workers so the
      // dashboard reflects admin changes without a reload.
      onConfigUpdate: () => {
        if (!cancelled && backendEnv.configured) {
          void useOfficeConfigStore.getState().fetchPublic(backendEnv.apiUrl);
        }
      },
      onWorkersUpdate: () => {
        if (!cancelled && backendEnv.configured) {
          void useOfficeConfigStore.getState().fetchPublic(backendEnv.apiUrl);
        }
      },
    });

    return () => {
      cancelled = true;
      window.clearTimeout(snapshotTimer);
      disconnect();
    };
  }, [wsUrl, reconnectToken]);

  // --- Stress mode: 12 deterministic extra agents ---------------------------
  useEffect(() => {
    const store = useAgentStore.getState();
    const extras = buildStressAgents();
    if (stressMode) {
      extras.forEach((a) => store.upsertLocal(a));
    } else {
      extras.forEach((a) => store.removeLocal(a.id));
    }
  }, [stressMode]);

  const selected = selectedId ? agents[selectedId] : null;

  return (
    <div className="app">
      <PublicOfficeSync />
      <DayNightSync />
      <WanderDirector />
      <PrayerDirector />
      <RecoveryDirector />
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
          {!sceneReady && <LoadingOverlay />}
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
  // The /admin console is a separate lazy-loaded app. This check runs at
  // the top of the default export, before any dashboard work.
  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/admin")
  ) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingOverlay />}>
          <AdminApp />
        </Suspense>
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
