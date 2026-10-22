# Architecture — Virtual AI Office

## Overview
Virtual AI Office is a 3D mission-control dashboard for monitoring AI agents.
A low-poly virtual office (React Three Fiber) visualizes each agent as a
character at a workstation; a dark-themed dashboard shows live status, tasks,
and event timelines. A Node backend ingests agent status events over REST,
broadcasts them over WebSocket, and ships a clearly-labeled demo mode so the
app is fully usable with no real agents connected.

```
┌──────────────┐   POST /api/agents/:id/events    ┌──────────────────┐
│ Real agents  │ ───────────────────────────────▶ │  apps/server     │
│ (any HTTP    │                                  │  Express + ws    │
│  client)     │   WS /ws: snapshot + updates     │  AgentRegistry   │
└──────────────┘ ◀─────────────────────────────── │  DemoAdapter     │
                                                  └────────┬─────────┘
┌──────────────┐   REST + WS (VITE_API_URL /               │
│ apps/web     │   VITE_WS_URL)                            │
│ React + R3F  │ ◀─────────────────────────────────────────┘
│ Zustand      │
└──────────────┘
```

## Monorepo layout (npm workspaces)

| Path | Package | Role |
|---|---|---|
| `packages/shared` | `@virtual-ai-office/shared` | Single source of truth: `AgentInfo`/`ActivityEntry`/message types + Zod `EventPostSchema` |
| `apps/server` | `@virtual-ai-office/server` | Express REST + `ws` hub + in-memory `AgentRegistry` + `AgentAdapter` seam + demo simulator |
| `apps/worker` | `@virtual-ai-office/worker` | Cloudflare Workers port of the backend: `AgentRoom` Durable Object (persisted registry) + same REST/WS contracts |
| `apps/web` | `@virtual-ai-office/web` | Vite + React 19 + Three.js (`@react-three/fiber` 9, `@react-three/drei` 10) + Zustand |
| `docs/` | — | Architecture, API, deployment, assets, smoke-test docs |
| `.github/workflows/ci.yml` | — | lint → typecheck → test → build |

## Backend targets

Two interchangeable backends implement the **same** REST + WebSocket contract
(validated by `packages/shared`); the frontend talks to either via
`VITE_API_URL` / `VITE_WS_URL`.

- **`apps/server` (Node)**: Express routes + `ws` upgrade on `/ws`. State in an
  in-memory `AgentRegistry`. Run locally with `npm run dev:server`, or deploy
  to any persistent Node host (VPS, Render, Fly.io…).
- **`apps/worker` (Cloudflare Workers, recommended for Cloudflare hosting)**:
  one `AgentRoom` Durable Object singleton (`idFromName("global")`) owns the
  registry, the WS clients, the demo simulator and the offline sweeper. State
  is persisted in `ctx.storage` (survives restarts — the Node server is
  in-memory only); demo ticks + sweeps run on `alarm()` every 3 s. The Worker
  itself is a thin CORS/routing layer. Local dev: `npm run dev:worker`
  (http://localhost:4001, no login needed). Deploy with `npx wrangler deploy`
  or the Workers Git integration.

## Backend (`apps/server`)

- **Transport**: one HTTP server; Express routes + `ws` upgrade on `/ws`.
- **State**: `AgentRegistry` (in-memory `Map`). No database in v1 — the seam is
  `store.ts`: a future Prisma-backed registry implements the same methods.
- **Ingestion**: `POST /api/agents/:id/events` validates with `EventPostSchema`
  (400 on invalid, malformed JSON → 400, never crashes). Unknown agents are
  created on first event (`source: 'live'`, `workstationId: 'ws-remote'`).
  Rate-limited (60/min/IP, env-tunable).
- **Broadcast**: every accepted event emits `agent.update` (+ `agent.event` when
  an activity entry is appended) to all WS clients. New clients get a full
  `snapshot` on connect. Server heartbeats every 15 s.
- **Offline detection**: sweeper marks live agents `offline` after
  `OFFLINE_TIMEOUT_MS` (default 30 s) without heartbeat/event; a new heartbeat
  revives them. Demo agents are heartbeated by the simulator so they stay online.
- **Adapters**: `AgentAdapter { name, start(emit), stop() }` — the integration
  seam. `DemoAdapter` feeds clearly-labeled (`source: 'demo'`) simulated
  events. Future Hermes Agent adapters implement this interface; the server
  never assumes external endpoints.
- **Monitoring only**: no endpoint executes anything on the host.

## Frontend (`apps/web`)

- **State** (Zustand, selective subscriptions — no per-frame React renders):
  `useAgentStore` (agents, selection, 100-cap global event feed),
  `useConnectionStore` (live / demo-local / connecting / error),
  `useSettingsStore` (URLs persisted to localStorage, stress mode, reconnect token),
  `useCameraStore` (focus requests, reset).
- **3D world** (`src/world/`): fully procedural low-poly office —
  **redesigned 2026-10-22 from the user's dream-office denah: 14 rooms**
  across 2 floors, all defined in `src/world/building/floorPlan.ts`
  (single source of truth). Ground floor: ruang meeting, ruang server,
  pantry, toilet (north band), ruang project (live Kanban project board),
  workspace (ws-01..ws-08 + hot-desk bullpen for stress/spawn), resepsionis
  (main entrance "Pintu Masuk"). Upper floor: ruang direksi, ruang konten,
  musola (prayer room with sajadah rows + qibla marker), ruang fokus,
  lounge (idle-agent hangout), ruang pemulihan (errored-agent pods —
  moved up from the ground floor), ruang R&D. Unroomed circulation
  (stair lobbies, indoor garden hall) is dressed by rooms/Circulation.tsx.
  Agents cross floors via the stair tower on the east side (floor-aware
  waypoints, `findPath3D`). Reusable furniture components, shared
  module-level geometries/materials, `instancedMesh` for chairs and plants,
  **one** shadow-casting light, `dpr` capped at 1.75. All animation lives in
  `useFrame` with refs.
- **Day/night** (`src/stores/useDayNightStore.ts`, `src/world/DayNightRig.tsx`):
  auto mode follows the viewer's local time (day 06:00–18:00), manual day/night
  override persisted in localStorage (`vao-daynight-mode`); interior and garden
  lights come on at night.
- **Honest loading gate** (`src/stores/useSceneReadyStore.ts`): the "Loading
  3D office…" overlay stays up until the first 3D frame has actually rendered
  (one-shot `useFrame` marker), not just until the JS module loads — this is
  what the old black-viewport report traced to: a very slow first frame
  (~1000 meshes × shadow pass ≈ 2000 draw calls on weak GPUs) with the
  spinner hiding at module load, *not* a lighting/camera bug.
- **Characters**: `AgentAvatar` — procedural placeholder (capsule body, sphere
  head, status ring, floating status indicator, drei `Billboard`+`Text` label).
  Per-status animation: working = typing bob, thinking = sway + pulse,
  idle = breathing, waiting = rotating ring, error = blinking indicator,
  offline = grayed + still. Honestly documented as placeholders, not rigged models.
- **Camera**: `OrbitControls` (damped, min/max distance, pan, touch) + eased
  tweens to a selected agent's desk on click ("Focus Agent"), Reset View button.
- **Connection**: WS with exponential-backoff reconnect; 6 s snapshot timeout →
  local demo fallback (badge: "DEMO MODE — simulated data"), transparently
  upgrades to live when the backend appears. Prod builds without
  `VITE_API_URL`/`VITE_WS_URL` show a "backend not configured" state.
- **Resilience**: `ErrorBoundary` + `Suspense` loading overlay + `AssetGuard`
  (renders a fallback if any lazy/external model fails to load).

## Shared contract
`packages/shared` owns the wire format. Both apps import types and the Zod
schema from it — the REST envelopes (`{agents}`, `{agent}`, `{events}`) and
all five `ServerMessage` variants are defined once, so frontend/backend cannot
drift.

## Performance notes
- Shared geometries/materials; instancing for repeated props; memoized static
  components; animation outside React state.
- Stress mode adds 22 deterministic extra agents (30 total) to verify the
  scene stays interactive. No frame-rate promises are made without measurement.
