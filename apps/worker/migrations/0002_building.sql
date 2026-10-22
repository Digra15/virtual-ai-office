-- 0002_building.sql — Building + recovery schema for the Virtual AI Office worker.
--
-- Applied with:  npx wrangler d1 migrations apply vao-admin
-- Local dev:     npx wrangler d1 migrations apply vao-admin --local
--
-- Mirrors the contracts in packages/shared/src/building.ts (the Zod schemas
-- are the source of truth; this file is the D1 persistence of those
-- shapes). D1 rows use snake_case columns; the worker maps them to the
-- camelCase shared types on read.
--
-- The recovery configuration itself lives in the existing `office_config`
-- table (key 'office.recovery', validated against RecoveryConfigSchema) —
-- no new table is needed for it.

-- Error events: reported agent failures and their acknowledgement
-- lifecycle. status: 'open' | 'acknowledged' | 'resolved'.
-- Allowed transitions (enforced server-side):
--   open -> acknowledged | resolved
--   acknowledged -> resolved
--   resolved -> (terminal)
CREATE TABLE IF NOT EXISTS error_events (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'unknown',
  message     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  TEXT NOT NULL,              -- ISO-8601 UTC
  resolved_at TEXT                        -- ISO-8601 UTC, set on resolve
);
CREATE INDEX IF NOT EXISTS idx_error_events_status ON error_events(status);
CREATE INDEX IF NOT EXISTS idx_error_events_agent  ON error_events(agent_id);
