# Admin backend setup — Virtual AI Office Worker

The admin panel (`/api/admin/*`) and the public storefront (`/api/public/*`)
run inside this Worker, backed by D1 (structured data) and R2 (character
`.glb`/`.gltf` uploads). The agent registry / WebSocket side is untouched —
it still lives in the `AgentRoom` Durable Object.

Prerequisites: this repo checked out, `npm install` done at the repo root,
and `npx wrangler login` completed. All commands run from `apps/worker/`.

---

## 1. Create the D1 database

Pick ONE:

```bash
# CLI
npx wrangler d1 create vao-admin
```

or Dashboard: **Workers & Pages → D1 → Create database** → name it `vao-admin`.

Copy the `database_id` from the output and paste it into `wrangler.toml`
under `[[d1_databases]]`, replacing `REPLACE_ME__run_wrangler_d1_create`.

## 2. Create the R2 bucket

Pick ONE:

```bash
# CLI
npx wrangler r2 bucket create vao-assets
```

or Dashboard: **R2 Object Storage → Create bucket** → name it `vao-assets`.

### Public access (needed for character-model URLs)

Pick ONE:

- **a)** R2 dashboard → bucket → **Settings → Public access → Allow**.
  Cloudflare gives you an `https://pub-xxxx.r2.dev` URL, or
- **b)** **Settings → Custom Domains** → connect e.g. `assets.example.com`.

Then set the base URL in `wrangler.toml` under `[vars]` (uncomment and fill
in `R2_PUBLIC_BASE_URL`), or set it as a plain (non-secret) variable in
**Worker → Settings → Variables**:

```toml
R2_PUBLIC_BASE_URL = "https://pub-xxxx.r2.dev"
```

If you skip this, uploads still work — the API stores the R2 key
(`characters/<id>.glb`) and returns it with `publicUrlConfigured: false`.

## 3. Set the secrets

```bash
npx wrangler secret put SETUP_TOKEN      # any long random string, e.g. output of: openssl rand -hex 32
npx wrangler secret put INTERNAL_SECRET  # a DIFFERENT long random string
```

Dashboard alternative: **Worker → Settings → Variables → Secrets**.

- `SETUP_TOKEN` authorizes the one-time `POST /api/admin/auth/setup`.
- `INTERNAL_SECRET` lets the Worker call the DO's `POST /__internal/publish`
  (the live-update broadcast channel). Without it, admin mutations still
  succeed — connected WS clients just won't get `config.update` /
  `workers.update` / `services.update` pushes.

**Never commit real ids or secrets to git.** `wrangler.toml` in this repo
only ever holds placeholders.

## 4. Run the migrations

```bash
npx wrangler d1 migrations apply vao-admin
# local dev instead: npx wrangler d1 migrations apply vao-admin --local
```

This creates `admin_users`, `admin_sessions`, `workers`, `services`,
`orders`, `office_config`, `audit_log`, `asset_manifest`
(see `migrations/0001_admin.sql`).

## 5. Deploy

```bash
npx wrangler deploy
```

(A Git-connected Worker reads `wrangler.toml` automatically — no extra config.)

## 6. Create the first admin user (one time only)

```bash
curl -X POST https://<your-worker-domain>/api/admin/auth/setup \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"<12+ characters>","setupToken":"<SETUP_TOKEN>"}'
```

- `201` → `{user}` created. Log in next via `POST /api/admin/auth/login`
  (same shape minus `setupToken`); the session arrives as an HttpOnly
  `vao_admin_session` cookie (24h, sliding expiry).
- Any later `/setup` call returns `403` — setup closes itself the moment the
  first admin exists, and also 403s on a wrong token. One `403` covers both
  cases on purpose (it never reveals whether an admin already exists).

---

## Honest limits & gotchas

- **No D1 bound?** `/api/admin/*` and `/api/public/*` answer
  `503 {error: "admin database not configured"}`. The agent registry, WS and
  `/health` keep working — only the admin/storefront surface is unavailable.
- **No R2 bound?** Asset upload/delete answer `503`; everything else works.
- **`/api/admin/orders/:id/payment` is a STUB.** It flips `paid=true` and
  records `{provider, providerRef}` plus an audit entry, but it does NOT
  verify anything with a payment provider. Wire real provider webhooks
  (signature-verified) before taking money. No other endpoint can set `paid`
  — transitions validate `canTransitionOrder` and 422 on illegal jumps.
- **Briefs are plain text.** `POST /orders` accepts a customer `brief`; it is
  stored as text and must never be executed as code by any consumer.
- **Cross-origin cookies.** The session cookie is `HttpOnly; Secure;
  SameSite=Lax`. The Worker currently sends `access-control-allow-origin: *`
  (no credentials), so a browser admin panel on a *different* origin
  (e.g. Pages) will not send the cookie cross-origin. Serve the admin UI
  same-origin as the API (or add credentialed CORS: reflect the Origin and
  send `access-control-allow-credentials: true`) before relying on browser
  login across origins.
- **Rate limits** (per Worker isolate, in-memory): login `5/min/IP`, all other
  admin routes `60/min/IP` → `429`.
- **Roles:** first user is `admin`. `viewer` accounts (created later via DB or
  a future user-management endpoint) may only use GET endpoints.
- **Deleting/archiving a worker never touches a live agent.** Archive is a
  soft flag (`archived=1`); the underlying agent keeps running.
