# Deployment — Virtual AI Office

## Important: split the deployment in two

The frontend is a **static site** (Vite build output). A static host cannot run
the Node/WebSocket backend, so you deploy **two** services:

1. **Frontend** → Cloudflare Pages or Vercel (static).
2. **Backend** → any persistent Node.js host (VPS, Render, Fly.io, Railway…).

Point the frontend at the backend with `VITE_API_URL` / `VITE_WS_URL` at **build
time** (Vite inlines `import.meta.env` values).

## 1. Backend (VPS example)

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

Build command: `npm run build --workspace @virtual-ai-office/web`
Output directory: `apps/web/dist`

Environment (set in the Pages/Vercel dashboard, then rebuild):
```
VITE_API_URL=https://api.office.example.com
VITE_WS_URL=wss://api.office.example.com/ws
```

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
