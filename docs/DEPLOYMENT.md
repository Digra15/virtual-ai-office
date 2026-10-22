# Deployment — Virtual AI Office

## Important: split the deployment in two

The frontend is a **static site** (Vite build output). A static host cannot run
a backend, so you deploy **two** services:

1. **Frontend** → Cloudflare Pages or Vercel (static).
2. **Backend** → **either** the Cloudflare Worker (`apps/worker`, recommended —
   same Cloudflare account, Durable Object state) **or** the Node server
   (`apps/server`) on any persistent Node.js host (VPS, Render, Fly.io,
   Railway…).

Point the frontend at the backend with `VITE_API_URL` / `VITE_WS_URL` at **build
time** (Vite inlines `import.meta.env` values).

## 1a. Backend on Cloudflare Workers (recommended)

`apps/worker/` is a full port of the Node backend: same REST contracts, same
WebSocket protocol, same Zod validation (via `packages/shared`). All agent
state lives in one `AgentRoom` Durable Object (persisted in DO storage, so it
survives restarts — the Node server is in-memory only). Demo simulator and the
offline sweeper run on the DO `alarm()` every 3 seconds.

**Vars** (`apps/worker/wrangler.toml` `[vars]`, or the Workers dashboard →
Settings → Variables):

| Var | Default | Meaning |
|---|---|---|
| `DEMO_MODE` | `"true"` | `"true"` runs the clearly-labeled demo simulator (8 demo agents). Set `"false"` once real agents report. |
| `OFFLINE_TIMEOUT_MS` | `"30000"` | Silent live agents are marked offline after this many ms. |
| `RATE_LIMIT_PER_MINUTE` | `"60"` | Max `POST /api/agents/:id/events` per IP per minute (429 beyond). |

**Deploy — option A: Workers Git integration (no CLI login needed)**

1. Cloudflare dashboard → Workers & Pages → Create → Workers → **Connect to Git**.
2. Select the `Digra15/virtual-ai-office` repo. It reads `apps/worker/wrangler.toml`
   automatically (build is a no-op for Workers; the file sets everything).
3. Set the root directory to `apps/worker` if prompted, then Deploy.
4. Note the assigned URL, e.g. `https://virtual-ai-office-api.<you>.workers.dev`.

**Deploy — option B: wrangler CLI**

```bash
cd apps/worker
npx wrangler login        # one-time, opens the browser
npx wrangler deploy
```

Local dev (no login needed): `npm run dev:worker` → `http://localhost:4001`.

Then point the Pages frontend at it (rebuild after setting these in the Pages
dashboard → Settings → Environment variables):

```
VITE_API_URL=https://virtual-ai-office-api.<you>.workers.dev
VITE_WS_URL=wss://virtual-ai-office-api.<you>.workers.dev/ws
```

## 1b. Backend (VPS example — Node server)

```bash
# on the server
git clone <repo> && cd virtual-ai-office
npm install --omit=dev
npm run build --workspace @virtual-ai-office/shared
npm run build --workspace @virtual-ai-office/server
cat > .env <<'EOF'
PORT=4000
CORS_ORIGIN=https://office.example.com
DEMO_MODE=false
OFFLINE_TIMEOUT_MS=30000
RATE_LIMIT_PER_MINUTE=60
EOF
```

**systemd** (`/etc/systemd/system/virtual-ai-office.service`):
```ini
[Unit]
Description=Virtual AI Office backend
After=network.target

[Service]
WorkingDirectory=/opt/virtual-ai-office
EnvironmentFile=/opt/virtual-ai-office/.env
ExecStart=/usr/bin/node apps/server/dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```
Then `systemctl enable --now virtual-ai-office`. Or with pm2:
`pm2 start apps/server/dist/index.js --name vao-server` (+ `pm2 save`).

Put it behind a reverse proxy (nginx/Caddy) with TLS and proxy WebSocket
upgrades (`/ws`) — browsers block `ws://` from `https://` pages, so serve the
backend over `wss://`.

## 2. Frontend (Cloudflare Pages / Vercel)

Connect the GitHub repo (`Digra15/virtual-ai-office`) in the Pages dashboard
(Workers & Pages → Create → Pages → Connect to Git), then set:

- **Build command:** `npm run build:shared && npm run build:web`
- **Output directory:** `apps/web/dist`
- **Environment variables:**
  - `NODE_VERSION=20` (required — `engines` demands Node ≥ 20)
  - Leave `VITE_API_URL` / `VITE_WS_URL` **unset** for a fully client-side demo:
    the production build then falls back to local demo mode (8 simulated
    agents, DEMO MODE badge, no backend needed).

To point the deployed frontend at a real backend later, set (then rebuild —
Vite inlines `import.meta.env` values at build time):

```
VITE_API_URL=https://api.office.example.com
VITE_WS_URL=wss://api.office.example.com/ws
```

(The Settings panel in the app can also switch the backend URL at runtime.)

## 3. Optional PostgreSQL persistence (not in v1)

v1 keeps state in memory (`AgentRegistry`). The seam is `apps/server/src/store.ts`:
implement the same class surface (`list/get/upsertFromEvent/markOfflineSweep/recentEvents`)
on top of Prisma + PostgreSQL, then swap the construction in `src/index.ts`.
Suggested tables: `agents(id, name, role, status, current_task, progress,
last_seen, workstation_id, source)` and `activity_entries(id, agent_id,
timestamp, kind, message)` with an index on `(agent_id, timestamp desc)`.

## Production checklist

- [ ] Backend reachable over HTTPS/WSS; `/health` returns `status: "ok"`.
- [ ] `CORS_ORIGIN` set to the frontend origin (not `*`).
- [ ] `DEMO_MODE=false` once real agents report in (or keep `true` for a demo).
- [ ] Frontend built with the production `VITE_API_URL` / `VITE_WS_URL`.
- [ ] Rate limit + `OFFLINE_TIMEOUT_MS` tuned for your agent heartbeat cadence.
- [ ] `.env` never committed (see `.env.example` for placeholders).
