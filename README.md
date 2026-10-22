# Virtual AI Office — 3D Mission Control

An interactive low-poly 3D virtual office that acts as a visual monitoring
dashboard for multiple AI agents. Walk (well — orbit) through the office, watch
each agent's live status at its workstation, click any character to inspect its
task and activity, and wire in your own agents over a documented HTTP/WebSocket
API. Runs fully offline in a clearly-labeled **demo mode** — no paid APIs needed.

## Features

- **Navigable 3D office** — open workspace, meeting room, mission-control room,
  lounge; 100% procedural low-poly geometry (zero third-party assets, clean licensing).
- **8 sample agents** (Nika, Research, Coding, Writing, Design, Data Analyst,
  Automation, Monitoring), each with status, task, progress, last-seen,
  workstation, and activity history.
- **6 statuses, visually distinct** — idle, working, thinking, waiting, error,
  offline — with per-status colors and simple procedural animations.
- **Camera**: orbit / zoom (limits) / pan, Reset View, Focus Agent with smooth
  tween, click-to-select, touch support.
- **Dark dashboard**: connection indicator, demo-mode badge, stat cards computed
  from live state, searchable + filterable agent list, detail panel, event
  timeline, settings (backend URLs, 30-agent stress mode, reconnect).
- **Real-time backend**: Express REST + WebSocket, Zod-validated event
  ingestion, rate limiting, offline detection, heartbeat tracking, multi-client
  broadcast, demo simulator, `AgentAdapter` seam for future integrations
  (e.g. Hermes Agent). Monitoring only — no remote execution.

> **Screenshots:** to be added after the first browser pass (see
> `docs/SMOKE_TEST.md`).

## Quick start

Requirements: Node ≥ 20, npm.

```bash
npm install

# Terminal 1 — backend (http://localhost:4000, ws://localhost:4000/ws)
npm run dev:server

# Terminal 2 — frontend (http://localhost:5173)
npm run dev:web
```

Open http://localhost:5173. With no real agents connected you get the labeled
demo simulation; connect a real agent (below) and it appears live.

**Cloudflare alternative:** `npm run dev:worker` runs the Workers backend
locally (http://localhost:4001, no login needed); deploy it with
`npx wrangler deploy` and point the frontend at it — see `docs/DEPLOYMENT.md`.

## Commands

| Command | What it does |
|---|---|
| `npm install` | install all workspaces |
| `npm run dev:server` / `npm run dev:web` / `npm run dev:worker` | dev servers (Node backend / frontend / Workers backend) |
| `npm run lint` | ESLint (must be zero errors) |
| `npm run typecheck` | `tsc --noEmit` in all workspaces |
| `npm run test` | vitest in all workspaces (57 tests) |
| `npm run build` | production builds (shared → server → web) |

## Connecting a real agent

```bash
# heartbeat every <30s keeps the agent online; unknown ids self-register
curl -X POST http://localhost:4000/api/agents/worker-1/events \
  -H 'Content-Type: application/json' -d '{"type":"heartbeat"}'
curl -X POST http://localhost:4000/api/agents/worker-1/events \
  -H 'Content-Type: application/json' \
  -d '{"type":"task","task":"Summarizing inbox","progress":35}'
```

Or run the sample client: `node apps/server/examples/report-agent.mjs [baseUrl] [agentId]`.
Full schema + WS protocol: [`docs/API.md`](docs/API.md). Env vars: [`.env.example`](.env.example).

## Architecture

npm workspaces monorepo — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md):

- `packages/shared` — types + Zod event schemas (single source of truth).
- `apps/server` — Express + `ws`, in-memory agent registry, demo adapter.
- `apps/web` — React 19 + Three.js (`@react-three/fiber`/`drei`) + Zustand.

Deployment (static frontend + persistent Node backend, incl. systemd/pm2 and an
optional Postgres note): [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
Asset licensing: [`docs/ASSETS.md`](docs/ASSETS.md) (all procedural, MIT).

## Project checklist

- [x] Monorepo scaffold, 3D office, camera + interaction
- [x] Agents, statuses, dashboard UI
- [x] Backend REST/WS, schemas, demo simulator, adapter seam
- [x] Tests (45), lint, typecheck, builds, live E2E validation
- [x] Docs + CI workflow
- [ ] Browser smoke test (`docs/SMOKE_TEST.md`) — visual pass on a real browser
- [ ] Screenshots for this README

## License

MIT — see [LICENSE](LICENSE). All 3D art is procedural and original to this
project; third-party *libraries* keep their own OSI licenses.
