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
- **2D pixel-art characters** — each agent is a procedurally generated
  28×36-pixel sprite (big chibi head, big anime eyes, unique hair/outfit/
  accessory per agent) rendered as a billboard inside the 3D office
  (2.5D Paper-Mario style). Frame-based animation per activity
  (idle/typing/thinking/walking/meeting/celebrate) plus blinking — no
  downloaded assets, fully customizable from the admin character editor.
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
- `apps/worker` — Cloudflare Worker backend: Durable Object agent registry +
  D1-backed admin API (workers, services, orders, office config, assets,
  audit) + R2 character-asset storage.

Deployment (static frontend + persistent Node backend, incl. systemd/pm2 and an
optional Postgres note): [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
Asset licensing: [`docs/ASSETS.md`](docs/ASSETS.md) (all procedural, MIT).

## Admin panel (`/admin`)

A full administration console at `/admin` (SPA route, served via
`apps/web/public/_redirects`). It requires the Cloudflare Worker backend with
D1 + R2 configured — without it, `/admin` shows a setup guide instead of
mockups.

**What it manages:** worker CRUD (stable ids; renaming never changes the
integration identity; delete = archive, never terminates an underlying agent),
character editor with live 2D pixel-art preview (built on the `CharacterPreset`
schema; custom PNG sprite sheets via manifest with per-sheet `supports` flags), office
configuration (branding, theme, rooms, workstations, assignments, visibility,
camera defaults — applied to the public 3D scene live, no rebuild), service
catalog (draft/published, pricing, AI-disclosure), orders (explicit states
`pending → accepted → queued → in_progress → review → completed`, plus
`cancelled`/`failed`; `paid` flips only via the verified-payment endpoint),
asset uploads (PNG sprite sheets ≤ 5 MB → R2), audit log, and auth settings.

**Authentication (real, no placeholders):** PBKDF2-SHA256 (210k iterations)
password hashing, D1-backed users/sessions, HttpOnly session cookie, first-run
setup gated by `SETUP_TOKEN`, no hardcoded credentials, no default password,
login rate-limited (5/min/IP). Until the setup flow completes against a live
backend, the panel honestly reports it is not secured yet.

**Setup (Cloudflare dashboard / CLI):**
1. `npx wrangler d1 create vao-admin` → paste `database_id` into
   `apps/worker/wrangler.toml`
2. `npx wrangler r2 bucket create vao-assets` → enable public access, set
   `R2_PUBLIC_BASE_URL`
3. `npx wrangler secret put SETUP_TOKEN` / `INTERNAL_SECRET` / `ADMIN_ORIGIN`
   (Pages URL, e.g. `https://virtual-ai-office.pages.dev` — enables
   credentialed CORS so the browser sends the session cookie)
4. `npx wrangler d1 migrations apply vao-admin`
5. Deploy the Worker, set `VITE_API_URL` on the Pages project, redeploy
6. `POST /api/admin/auth/setup` once (username ≥3 chars, password ≥12 chars,
   plus your `SETUP_TOKEN`)

Full walkthrough: `apps/worker/SETUP.md`. API reference: Zod contracts in
`packages/shared/src/admin.ts` (`ADMIN_API` / `PUBLIC_API` path constants).

**Live updates:** admin mutations broadcast via the `AgentRoom` Durable Object
(`config.update` / `workers.update` / `services.update`); the public page
applies them immediately and polls every 30s as a fallback. Without a backend
the public scene runs unchanged in local demo mode.

**Known limitations:** D1/R2/secrets must be created by you (no CI credentials
here); payment marking is a stub until a real provider webhook is wired (never
claim paid otherwise); custom PNG sprite-sheet support is manifest-ready but no
sheets ship yet (the procedural pixel-art sprite is the built-in source); office layout editing is
config-based in v1 (drag-and-drop placement is a documented extension point).

## Project checklist

- [x] Monorepo scaffold, 3D office, camera + interaction
- [x] Agents, statuses, dashboard UI
- [x] Backend REST/WS, schemas, demo simulator, adapter seam
- [x] Tests (204: 125 web + 52 worker + 27 shared), lint, typecheck, builds, live E2E validation
- [x] Docs + CI workflow
- [x] Admin panel (`/admin`): D1/R2 auth, worker/service/order/config/assets API, character editor, live updates
- [ ] Cloudflare setup by user: D1 + R2 + secrets + migrations (see "Admin panel" above)
- [ ] Browser smoke test (`docs/SMOKE_TEST.md`) — visual pass on a real browser
- [ ] Screenshots for this README

## License

MIT — see [LICENSE](LICENSE). All 3D art is procedural and original to this
project; third-party *libraries* keep their own OSI licenses.
