-- 0001_admin.sql — Admin panel schema for the Virtual AI Office worker.
--
-- Applied with:  npx wrangler d1 migrations apply vao-admin
-- Local dev:     npx wrangler d1 migrations apply vao-admin --local
--
-- Mirrors the contracts in packages/shared/src/admin.ts (the Zod schemas are
-- the source of truth; this file is the D1 persistence of those shapes).
-- D1 rows use snake_case columns; the worker maps them to the camelCase
-- shared types on read.

-- Admin accounts. Roles: 'admin' (full) | 'viewer' (GET only).
CREATE TABLE IF NOT EXISTS admin_users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,          -- pbkdf2-sha256$210000$<b64 salt>$<b64 hash>
  role          TEXT NOT NULL DEFAULT 'viewer',
  created_at    TEXT NOT NULL,          -- ISO-8601 UTC
  last_login_at TEXT
);

-- Sessions. id = sha256 hex of the opaque session token (the token itself is
-- only ever in the HttpOnly cookie, never in the DB).
CREATE TABLE IF NOT EXISTS admin_sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES admin_users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,             -- sliding: bumped on every authed request
  ip         TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user    ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expires_at);

-- Workers: curated worker records. `id` is the STABLE integration identity —
-- it never changes, even on rename. `agent_source` is opaque metadata about
-- the underlying agent; archiving/deleting a record NEVER touches any live
-- agent. JSON columns: character_config, services, display_settings.
CREATE TABLE IF NOT EXISTS workers (
  id                TEXT PRIMARY KEY,
  display_name      TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'assistant',
  description       TEXT NOT NULL DEFAULT '',
  agent_source      TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'offline',
  last_seen         TEXT,
  current_task      TEXT NOT NULL DEFAULT '',
  workstation_id    TEXT NOT NULL DEFAULT '',
  public_visible    INTEGER NOT NULL DEFAULT 1,
  character_model   TEXT NOT NULL DEFAULT 'procedural-chibi',
  character_config  TEXT NOT NULL DEFAULT '{}',
  accent_color      TEXT NOT NULL DEFAULT '#38bdf8',
  animation_profile TEXT NOT NULL DEFAULT 'default',
  services          TEXT NOT NULL DEFAULT '[]',
  sort_order        INTEGER NOT NULL DEFAULT 0,
  display_settings  TEXT NOT NULL DEFAULT '{}',
  archived          INTEGER NOT NULL DEFAULT 0,   -- soft delete; 1 = archived
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workers_sort    ON workers(sort_order);
CREATE INDEX IF NOT EXISTS idx_workers_public  ON workers(public_visible, archived);

-- Services offered. status: 'draft' | 'published'. JSON column: portfolio.
-- worker_id is informational (SET NULL semantics: deleting a worker does not
-- delete services).
CREATE TABLE IF NOT EXISTS services (
  id                 TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  worker_id          TEXT,
  price              REAL NOT NULL DEFAULT 0,
  currency           TEXT NOT NULL DEFAULT 'USD',
  delivery_estimate  TEXT NOT NULL DEFAULT '',
  input_requirements TEXT NOT NULL DEFAULT '',
  revision_policy    TEXT NOT NULL DEFAULT '',
  status             TEXT NOT NULL DEFAULT 'draft',
  portfolio          TEXT NOT NULL DEFAULT '[]',
  ai_disclosure      TEXT NOT NULL DEFAULT '',
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_services_sort   ON services(sort_order);

-- Orders. `paid` may ONLY be flipped by the verified payment endpoint
-- (POST /api/admin/orders/:id/payment); normal updates can never set it.
-- JSON columns: attachments, deliverables. The customer `brief` is stored as
-- plain text and MUST never be executed as code.
CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  customer_name   TEXT NOT NULL DEFAULT '',
  customer_contact TEXT NOT NULL DEFAULT '',   -- private: admin eyes only
  service_id      TEXT NOT NULL,
  brief           TEXT NOT NULL DEFAULT '',
  attachments     TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'pending',
  worker_id       TEXT,
  paid            INTEGER NOT NULL DEFAULT 0,
  payment_ref     TEXT,
  deliverables    TEXT NOT NULL DEFAULT '[]',
  review_state    TEXT NOT NULL DEFAULT 'none',
  review_note     TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  completed_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_service ON orders(service_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Office configuration: one row per key, JSON value. Valid keys are exactly
-- the keys of OFFICE_CONFIG_SCHEMAS in packages/shared/src/admin.ts.
CREATE TABLE IF NOT EXISTS office_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

-- Audit log: every admin mutation writes one row. Append-only by convention.
-- JSON column: detail.
CREATE TABLE IF NOT EXISTS audit_log (
  id        TEXT PRIMARY KEY,
  at        TEXT NOT NULL,
  actor     TEXT NOT NULL,              -- admin username (or 'system')
  action    TEXT NOT NULL,              -- e.g. 'worker.create'
  entity    TEXT NOT NULL,              -- e.g. 'worker'
  entity_id TEXT NOT NULL,
  detail    TEXT NOT NULL DEFAULT '{}',
  ip        TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_log_at ON audit_log(at DESC);

-- Character asset manifest: uploaded .glb/.gltf files living in the ASSETS
-- R2 bucket. `url` is the public URL when R2_PUBLIC_BASE_URL is configured,
-- otherwise the raw R2 key (characters/<id>.glb).
-- JSON columns: supports, animations.
CREATE TABLE IF NOT EXISTS asset_manifest (
  id         TEXT PRIMARY KEY,
  url        TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'glb',
  attribution TEXT NOT NULL DEFAULT '',
  license    TEXT NOT NULL DEFAULT '',
  supports   TEXT NOT NULL DEFAULT '{}',
  animations TEXT NOT NULL DEFAULT '[]',
  height     REAL,
  created_at TEXT NOT NULL
);
