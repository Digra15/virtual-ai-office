/**
 * Admin + public storefront API for the Cloudflare Worker.
 *
 * Mounted by src/index.ts: /api/admin/* and /api/public/* are intercepted
 * BEFORE the request reaches the AgentRoom Durable Object. Everything else
 * keeps forwarding to the DO.
 *
 * Rules enforced here:
 * - Every admin mutation is validated with the Zod contracts from
 *   @virtual-ai-office/shared, audit-logged (actor/action/entity/detail/ip),
 *   then broadcast to live WS clients via the DO's /__internal/publish.
 * - Roles: 'admin' may mutate; 'viewer' may only GET. Roles come from the DB
 *   row — client claims are never trusted.
 * - Without a D1 binding every route answers 503 {error:'admin database not
 *   configured'} — the worker itself still runs.
 * - Rate limits: POST /api/admin/auth/login 5/min/IP; all other /api/admin/*
 *   60/min/IP (in-memory sliding window, per Worker isolate).
 * - Orders: `paid` can ONLY be set by POST /orders/:id/payment (a stub that
 *   records the provider ref — see SETUP.md; it does NOT verify payment).
 *   Normal transitions can never flip `paid`.
 */
import { z } from 'zod';
import {
  ADMIN_BROADCAST_TYPES,
  ASSET_UPLOAD_LIMITS,
  ErrorEventCreateSchema,
  ErrorEventUpdateSchema,
  OFFICE_CONFIG_SCHEMAS,
  OrderCreateSchema,
  OrderPaymentSchema,
  OrderTransitionSchema,
  PublicServiceSchema,
  PublicWorkerSchema,
  ServiceCreateSchema,
  ServiceUpdateSchema,
  WorkerCreateSchema,
  WorkerUpdateSchema,
  canTransitionErrorEvent,
  canTransitionOrder,
  type AdminBroadcastType,
  type OfficeConfigKey,
  type PublicWorker,
} from '@virtual-ai-office/shared';
import type { Env } from '../env';
import { SlidingWindowLimiter } from '../ratelimit';
import {
  audit,
  clientIp,
  mapAssetRow,
  mapAuditRow,
  mapErrorEventRow,
  mapOrderRow,
  mapServiceRow,
  mapWorkerRow,
  randomHex,
  type Row,
} from './db';
import { err, json, readJson } from './http';
import {
  handleLogin,
  handleLogout,
  handleMe,
  handleSetup,
  requireAdmin,
  requireRole,
} from './auth';

// ------------------------------------------------------------ rate limiting

let loginLimiter = new SlidingWindowLimiter(60_000, 5);
let adminLimiter = new SlidingWindowLimiter(60_000, 60);

/** Test hook: drop in-memory limiter state between tests. */
export function resetAdminRateLimiters(): void {
  loginLimiter = new SlidingWindowLimiter(60_000, 5);
  adminLimiter = new SlidingWindowLimiter(60_000, 60);
}

/** Returns a 429 response when the caller is over the limit, else null. */
export function enforceRateLimit(request: Request): Response | null {
  const path = new URL(request.url).pathname;
  const ip = clientIp(request);
  if (path === '/api/admin/auth/login') {
    if (!loginLimiter.take(`login:${ip}`)) {
      return err(429, 'Too many login attempts — try again in a minute.');
    }
    return null;
  }
  if (!adminLimiter.take(`admin:${ip}`)) {
    return err(429, 'Rate limit exceeded — slow down and retry.');
  }
  return null;
}

// ---------------------------------------------------------------- broadcast

/**
 * Tell live WS clients that admin data changed. Fire-and-forget safe: any
 * failure is swallowed so a broadcast problem can never fail the mutation.
 */
export async function notifyClients(env: Env, type: AdminBroadcastType): Promise<void> {
  try {
    const ns = env.AGENT_ROOM;
    if (!ns) return;
    if (!ADMIN_BROADCAST_TYPES.includes(type)) return;
    const stub = ns.get(ns.idFromName('global'));
    await stub.fetch(
      new Request('https://internal/__internal/publish', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Internal-Secret': env.INTERNAL_SECRET ?? '',
        },
        body: JSON.stringify({ type }),
      }),
    );
  } catch {
    // Swallowed on purpose — see doc comment.
  }
}

// ------------------------------------------------------------------ helpers

function insertSql(table: string, cols: string): string {
  const list = cols.split(',').map((c) => c.trim());
  return `INSERT INTO ${table} (${list.join(', ')}) VALUES (${list.map(() => '?').join(', ')})`;
}

function buildUpdate(
  table: string,
  fieldMap: Record<string, string>,
  jsonFields: Set<string>,
  boolFields: Set<string>,
  id: string,
  data: Record<string, unknown>,
): { sql: string; params: unknown[] } {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [camel, value] of Object.entries(data)) {
    if (value === undefined) continue;
    const col = fieldMap[camel];
    if (!col) continue;
    let v: unknown = value;
    if (jsonFields.has(camel)) v = JSON.stringify(value);
    else if (boolFields.has(camel)) v = value ? 1 : 0;
    sets.push(`${col} = ?`);
    params.push(v);
  }
  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  return { sql: `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, params };
}

function splitSegments(pathname: string, prefix: string): string[] {
  return pathname
    .slice(prefix.length)
    .split('/')
    .filter((s) => s.length > 0)
    .map((s) => decodeURIComponent(s));
}

// ------------------------------------------------------------------ workers

const WORKER_COLS =
  'id, display_name, role, description, agent_source, status, last_seen, current_task, workstation_id, public_visible, character_model, character_config, accent_color, animation_profile, services, sort_order, display_settings, archived, created_at, updated_at';

const WORKER_FIELD_MAP: Record<string, string> = {
  displayName: 'display_name',
  role: 'role',
  description: 'description',
  status: 'status',
  lastSeen: 'last_seen',
  currentTask: 'current_task',
  workstationId: 'workstation_id',
  publicVisible: 'public_visible',
  characterModel: 'character_model',
  characterConfig: 'character_config',
  accentColor: 'accent_color',
  animationProfile: 'animation_profile',
  services: 'services',
  sortOrder: 'sort_order',
  displaySettings: 'display_settings',
  archived: 'archived',
  // NOTE: `id` and `agentSource` are deliberately absent — updates can never
  // change a worker's identity or touch the underlying agent.
};
const WORKER_JSON_FIELDS = new Set(['characterConfig', 'services', 'displaySettings']);
const WORKER_BOOL_FIELDS = new Set(['publicVisible', 'archived']);

async function listWorkers(db: D1Database, url: URL): Promise<Response> {
  const includeArchived = url.searchParams.get('includeArchived') === '1';
  const sql = includeArchived
    ? `SELECT ${WORKER_COLS} FROM workers ORDER BY sort_order ASC`
    : `SELECT ${WORKER_COLS} FROM workers WHERE archived = ? ORDER BY sort_order ASC`;
  const stmt = db.prepare(sql);
  const { results } = includeArchived
    ? await stmt.bind().all<Row>()
    : await stmt.bind(0).all<Row>();
  return json({ workers: results.map(mapWorkerRow) });
}

async function createWorker(
  db: D1Database,
  request: Request,
  env: Env,
  actor: string,
): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return err(400, 'Invalid JSON body');
  const parsed = WorkerCreateSchema.safeParse(body.value);
  if (!parsed.success) return err(400, 'Invalid worker payload', parsed.error.flatten());
  const data = parsed.data;
  const exists = await db.prepare('SELECT id FROM workers WHERE id = ?').bind(data.id).first();
  if (exists) return err(409, `Worker already exists: ${data.id}`);
  const now = new Date().toISOString();
  await db
    .prepare(insertSql('workers', WORKER_COLS))
    .bind(
      data.id,
      data.displayName,
      data.role,
      data.description,
      data.agentSource,
      data.status,
      data.lastSeen,
      data.currentTask,
      data.workstationId,
      data.publicVisible ? 1 : 0,
      data.characterModel,
      JSON.stringify(data.characterConfig),
      data.accentColor,
      data.animationProfile,
      JSON.stringify(data.services),
      data.sortOrder,
      JSON.stringify(data.displaySettings),
      data.archived ? 1 : 0,
      now,
      now,
    )
    .run();
  await audit(db, {
    actor,
    action: 'worker.create',
    entity: 'worker',
    entityId: data.id,
    detail: { displayName: data.displayName },
    ip: clientIp(request),
  });
  await notifyClients(env, 'workers.update');
  const row = await db.prepare(`SELECT ${WORKER_COLS} FROM workers WHERE id = ?`).bind(data.id).first<Row>();
  return json({ worker: mapWorkerRow(row ?? {}) }, 201);
}

async function getWorker(db: D1Database, id: string): Promise<Response> {
  const row = await db.prepare(`SELECT ${WORKER_COLS} FROM workers WHERE id = ?`).bind(id).first<Row>();
  if (!row) return err(404, `Unknown worker: ${id}`);
  return json({ worker: mapWorkerRow(row) });
}

async function updateWorker(
  db: D1Database,
  id: string,
  request: Request,
  env: Env,
  actor: string,
): Promise<Response> {
  const existing = await db.prepare(`SELECT ${WORKER_COLS} FROM workers WHERE id = ?`).bind(id).first<Row>();
  if (!existing) return err(404, `Unknown worker: ${id}`);
  const body = await readJson(request);
  if (!body.ok) return err(400, 'Invalid JSON body');
  const parsed = WorkerUpdateSchema.safeParse(body.value);
  if (!parsed.success) return err(400, 'Invalid worker payload', parsed.error.flatten());
  // Only keys the client actually sent are updated. (Zod .default() fills in
  // absent keys, so iterating parsed.data would reset untouched fields.)
  // id/agentSource are stripped even if present — a rename can never change
  // identity or touch the underlying agent.
  const raw = body.value as Record<string, unknown>;
  const validated = parsed.data as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (key === 'id' || key === 'agentSource') continue;
    if (key in validated) data[key] = validated[key];
  }
  const upd = buildUpdate('workers', WORKER_FIELD_MAP, WORKER_JSON_FIELDS, WORKER_BOOL_FIELDS, id, data);
  await db.prepare(upd.sql).bind(...upd.params).run();
  const row = await db.prepare(`SELECT ${WORKER_COLS} FROM workers WHERE id = ?`).bind(id).first<Row>();
  await audit(db, {
    actor,
    action: 'worker.update',
    entity: 'worker',
    entityId: id,
    detail: { changes: Object.keys(data) },
    ip: clientIp(request),
  });
  await notifyClients(env, 'workers.update');
  return json({ worker: mapWorkerRow(row ?? {}) });
}

/**
 * Soft-delete: marks archived=1. This NEVER touches any live agent — it only
 * hides the curated record.
 */
async function archiveWorker(
  db: D1Database,
  id: string,
  request: Request,
  env: Env,
  actor: string,
): Promise<Response> {
  const existing = await db.prepare(`SELECT ${WORKER_COLS} FROM workers WHERE id = ?`).bind(id).first<Row>();
  if (!existing) return err(404, `Unknown worker: ${id}`);
  await db
    .prepare('UPDATE workers SET archived = ?, updated_at = ? WHERE id = ?')
    .bind(1, new Date().toISOString(), id)
    .run();
  await audit(db, {
    actor,
    action: 'worker.archive',
    entity: 'worker',
    entityId: id,
    ip: clientIp(request),
  });
  await notifyClients(env, 'workers.update');
  const row = await db.prepare(`SELECT ${WORKER_COLS} FROM workers WHERE id = ?`).bind(id).first<Row>();
  return json({ worker: mapWorkerRow(row ?? {}) });
}

async function restoreWorker(
  db: D1Database,
  id: string,
  request: Request,
  env: Env,
  actor: string,
): Promise<Response> {
  const existing = await db.prepare(`SELECT ${WORKER_COLS} FROM workers WHERE id = ?`).bind(id).first<Row>();
  if (!existing) return err(404, `Unknown worker: ${id}`);
  await db
    .prepare('UPDATE workers SET archived = ?, updated_at = ? WHERE id = ?')
    .bind(0, new Date().toISOString(), id)
    .run();
  await audit(db, {
    actor,
    action: 'worker.restore',
    entity: 'worker',
    entityId: id,
    ip: clientIp(request),
  });
  await notifyClients(env, 'workers.update');
  const row = await db.prepare(`SELECT ${WORKER_COLS} FROM workers WHERE id = ?`).bind(id).first<Row>();
  return json({ worker: mapWorkerRow(row ?? {}) });
}

// ----------------------------------------------------------------- services

const SERVICE_COLS =
  'id, title, description, worker_id, price, currency, delivery_estimate, input_requirements, revision_policy, status, portfolio, ai_disclosure, sort_order, created_at, updated_at';

const SERVICE_FIELD_MAP: Record<string, string> = {
  title: 'title',
  description: 'description',
  workerId: 'worker_id',
  price: 'price',
  currency: 'currency',
  deliveryEstimate: 'delivery_estimate',
  inputRequirements: 'input_requirements',
  revisionPolicy: 'revision_policy',
  status: 'status',
  portfolio: 'portfolio',
  aiDisclosure: 'ai_disclosure',
  sortOrder: 'sort_order',
};
const SERVICE_JSON_FIELDS = new Set(['portfolio']);

async function listServices(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare(`SELECT ${SERVICE_COLS} FROM services ORDER BY sort_order ASC`)
    .bind()
    .all<Row>();
  return json({ services: results.map(mapServiceRow) });
}

async function createService(
  db: D1Database,
  request: Request,
  env: Env,
  actor: string,
): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return err(400, 'Invalid JSON body');
  const parsed = ServiceCreateSchema.safeParse(body.value);
  if (!parsed.success) return err(400, 'Invalid service payload', parsed.error.flatten());
  const data = parsed.data;
  const exists = await db.prepare('SELECT id FROM services WHERE id = ?').bind(data.id).first();
  if (exists) return err(409, `Service already exists: ${data.id}`);
  const now = new Date().toISOString();
  await db
    .prepare(insertSql('services', SERVICE_COLS))
    .bind(
      data.id,
      data.title,
      data.description,
      data.workerId,
      data.price,
      data.currency,
      data.deliveryEstimate,
      data.inputRequirements,
      data.revisionPolicy,
      data.status,
      JSON.stringify(data.portfolio),
      data.aiDisclosure,
      data.sortOrder,
      now,
      now,
    )
    .run();
  await audit(db, {
    actor,
    action: 'service.create',
    entity: 'service',
    entityId: data.id,
    detail: { title: data.title },
    ip: clientIp(request),
  });
  await notifyClients(env, 'services.update');
  const row = await db.prepare(`SELECT ${SERVICE_COLS} FROM services WHERE id = ?`).bind(data.id).first<Row>();
  return json({ service: mapServiceRow(row ?? {}) }, 201);
}

async function getService(db: D1Database, id: string): Promise<Response> {
  const row = await db.prepare(`SELECT ${SERVICE_COLS} FROM services WHERE id = ?`).bind(id).first<Row>();
  if (!row) return err(404, `Unknown service: ${id}`);
  return json({ service: mapServiceRow(row) });
}

async function updateService(
  db: D1Database,
  id: string,
  request: Request,
  env: Env,
  actor: string,
): Promise<Response> {
  const existing = await db.prepare(`SELECT ${SERVICE_COLS} FROM services WHERE id = ?`).bind(id).first<Row>();
  if (!existing) return err(404, `Unknown service: ${id}`);
  const body = await readJson(request);
  if (!body.ok) return err(400, 'Invalid JSON body');
  const parsed = ServiceUpdateSchema.safeParse(body.value);
  if (!parsed.success) return err(400, 'Invalid service payload', parsed.error.flatten());
  // Only keys the client actually sent are updated (see updateWorker).
  const raw = body.value as Record<string, unknown>;
  const validated = parsed.data as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (key === 'id') continue;
    if (key in validated) data[key] = validated[key];
  }
  const upd = buildUpdate('services', SERVICE_FIELD_MAP, SERVICE_JSON_FIELDS, new Set(), id, data);
  await db.prepare(upd.sql).bind(...upd.params).run();
  const row = await db.prepare(`SELECT ${SERVICE_COLS} FROM services WHERE id = ?`).bind(id).first<Row>();
  await audit(db, {
    actor,
    action: 'service.update',
    entity: 'service',
    entityId: id,
    detail: { changes: Object.keys(data) },
    ip: clientIp(request),
  });
  await notifyClients(env, 'services.update');
  return json({ service: mapServiceRow(row ?? {}) });
}

async function deleteService(
  db: D1Database,
  id: string,
  request: Request,
  env: Env,
  actor: string,
): Promise<Response> {
  const existing = await db.prepare(`SELECT ${SERVICE_COLS} FROM services WHERE id = ?`).bind(id).first<Row>();
  if (!existing) return err(404, `Unknown service: ${id}`);
  await db.prepare('DELETE FROM services WHERE id = ?').bind(id).run();
  await audit(db, {
    actor,
    action: 'service.delete',
    entity: 'service',
    entityId: id,
    ip: clientIp(request),
  });
  await notifyClients(env, 'services.update');
  return json({ ok: true });
}

// ------------------------------------------------------------------- orders

const ORDER_COLS =
  'id, customer_name, customer_contact, service_id, brief, attachments, status, worker_id, paid, payment_ref, deliverables, review_state, review_note, created_at, updated_at, completed_at';

async function listOrders(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare(`SELECT ${ORDER_COLS} FROM orders ORDER BY created_at DESC`)
    .bind()
    .all<Row>();
  return json({ orders: results.map(mapOrderRow) });
}

async function createOrder(
  db: D1Database,
  request: Request,
  actor: string,
): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return err(400, 'Invalid JSON body');
  const parsed = OrderCreateSchema.safeParse(body.value);
  if (!parsed.success) return err(400, 'Invalid order payload', parsed.error.flatten());
  const data = parsed.data;
  const service = await db.prepare('SELECT id FROM services WHERE id = ?').bind(data.serviceId).first();
  if (!service) return err(404, `Unknown service: ${data.serviceId}`);
  const id = data.id ?? `ord_${randomHex(12)}`;
  const exists = await db.prepare('SELECT id FROM orders WHERE id = ?').bind(id).first();
  if (exists) return err(409, `Order already exists: ${id}`);
  const now = new Date().toISOString();
  await db
    .prepare(insertSql('orders', ORDER_COLS))
    .bind(
      id,
      data.customerName,
      data.customerContact,
      data.serviceId,
      data.brief,
      JSON.stringify(data.attachments),
      'pending',
      data.workerId,
      0,
      null,
      '[]',
      'none',
      '',
      now,
      now,
      null,
    )
    .run();
  await audit(db, {
    actor,
    action: 'order.create',
    entity: 'order',
    entityId: id,
    detail: { serviceId: data.serviceId },
    ip: clientIp(request),
  });
  // Orders are admin-eyes-only: no WS broadcast on create.
  const row = await db.prepare(`SELECT ${ORDER_COLS} FROM orders WHERE id = ?`).bind(id).first<Row>();
  return json({ order: mapOrderRow(row ?? {}) }, 201);
}

async function getOrder(db: D1Database, id: string): Promise<Response> {
  const row = await db.prepare(`SELECT ${ORDER_COLS} FROM orders WHERE id = ?`).bind(id).first<Row>();
  if (!row) return err(404, `Unknown order: ${id}`);
  return json({ order: mapOrderRow(row) });
}

async function transitionOrder(
  db: D1Database,
  id: string,
  request: Request,
  actor: string,
): Promise<Response> {
  const row = await db.prepare(`SELECT ${ORDER_COLS} FROM orders WHERE id = ?`).bind(id).first<Row>();
  if (!row) return err(404, `Unknown order: ${id}`);
  const body = await readJson(request);
  if (!body.ok) return err(400, 'Invalid JSON body');
  const parsed = OrderTransitionSchema.safeParse(body.value);
  if (!parsed.success) return err(400, 'Invalid transition payload', parsed.error.flatten());
  const order = mapOrderRow(row);
  const { to, note } = parsed.data;
  if (!canTransitionOrder(order.status, to)) {
    return err(422, `Cannot transition order from "${order.status}" to "${to}"`);
  }
  const now = new Date().toISOString();
  const completedAt = to === 'completed' ? now : order.completedAt;
  await db
    .prepare('UPDATE orders SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?')
    .bind(to, completedAt, now, id)
    .run();
  await audit(db, {
    actor,
    action: 'order.transition',
    entity: 'order',
    entityId: id,
    detail: { from: order.status, to, note },
    ip: clientIp(request),
  });
  const updated = await db.prepare(`SELECT ${ORDER_COLS} FROM orders WHERE id = ?`).bind(id).first<Row>();
  return json({ order: mapOrderRow(updated ?? {}) });
}

/**
 * The ONLY path that sets paid=true. STUB: records the provider + provider
 * ref and audit-logs them. It does NOT verify anything with a payment
 * provider — a real integration must validate the providerRef via the
 * provider's webhook/signature before trusting `paid`. See SETUP.md.
 */
async function recordOrderPayment(
  db: D1Database,
  id: string,
  request: Request,
  actor: string,
): Promise<Response> {
  const row = await db.prepare(`SELECT ${ORDER_COLS} FROM orders WHERE id = ?`).bind(id).first<Row>();
  if (!row) return err(404, `Unknown order: ${id}`);
  const body = await readJson(request);
  if (!body.ok) return err(400, 'Invalid JSON body');
  const parsed = OrderPaymentSchema.safeParse(body.value);
  if (!parsed.success) return err(400, 'Invalid payment payload', parsed.error.flatten());
  const order = mapOrderRow(row);
  if (order.paid) return err(409, 'Order is already paid');
  const now = new Date().toISOString();
  await db
    .prepare('UPDATE orders SET paid = ?, payment_ref = ?, updated_at = ? WHERE id = ?')
    .bind(1, parsed.data.providerRef, now, id)
    .run();
  await audit(db, {
    actor,
    action: 'order.payment',
    entity: 'order',
    entityId: id,
    detail: {
      provider: parsed.data.provider,
      providerRef: parsed.data.providerRef,
      stub: true,
      note: 'Payment recorded without provider verification — wire real webhooks before taking money.',
    },
    ip: clientIp(request),
  });
  const updated = await db.prepare(`SELECT ${ORDER_COLS} FROM orders WHERE id = ?`).bind(id).first<Row>();
  return json({ order: mapOrderRow(updated ?? {}) });
}

// ------------------------------------------------------------------- config

async function listConfig(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare('SELECT key, value, updated_at, updated_by FROM office_config')
    .bind()
    .all<Row>();
  const config: Record<string, unknown> = {};
  for (const row of results) {
    try {
      config[String(row.key)] = JSON.parse(String(row.value));
    } catch {
      config[String(row.key)] = null;
    }
  }
  return json({ config });
}

async function putConfig(
  db: D1Database,
  key: string,
  request: Request,
  env: Env,
  actor: string,
): Promise<Response> {
  const schema = (OFFICE_CONFIG_SCHEMAS as Record<string, z.ZodTypeAny>)[key];
  if (!schema) return err(400, `Unknown config key: ${key}`);
  const body = await readJson(request);
  if (!body.ok || typeof body.value !== 'object' || body.value === null) {
    return err(400, 'Invalid JSON body — expected {"value": ...}');
  }
  const rawValue = (body.value as Record<string, unknown>).value;
  const parsed = schema.safeParse(rawValue);
  if (!parsed.success) {
    return err(400, `Invalid value for config key "${key}"`, parsed.error.flatten());
  }
  const now = new Date().toISOString();
  const valueJson = JSON.stringify(parsed.data);
  const updated = await db
    .prepare('UPDATE office_config SET value = ?, updated_at = ?, updated_by = ? WHERE key = ?')
    .bind(valueJson, now, actor, key)
    .run();
  if (updated.meta.changes === 0) {
    await db
      .prepare('INSERT INTO office_config (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)')
      .bind(key, valueJson, now, actor)
      .run();
  }
  await audit(db, {
    actor,
    action: 'config.update',
    entity: 'config',
    entityId: key,
    detail: { key },
    ip: clientIp(request),
  });
  await notifyClients(env, 'config.update');
  return json({ key, value: parsed.data });
}

// ------------------------------------------------------------------- assets

const ASSET_COLS = 'id, url, kind, attribution, license, supports, animations, frame_width, frame_height, created_at';
const ASSET_ID_SCHEMA = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'id must be URL-safe');

async function listAssets(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare(`SELECT ${ASSET_COLS} FROM asset_manifest ORDER BY created_at DESC`)
    .bind()
    .all<Row>();
  return json({ assets: results.map(mapAssetRow) });
}

/** Runtime check for an uploaded file (avoids `instanceof File` typing quirks). */
function isUploadFile(v: unknown): v is File {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { size?: unknown }).size === 'number' &&
    typeof (v as { name?: unknown }).name === 'string' &&
    typeof (v as { arrayBuffer?: unknown }).arrayBuffer === 'function'
  );
}

async function uploadAsset(
  db: D1Database,
  request: Request,
  env: Env,
  actor: string,
): Promise<Response> {
  if (!env.ASSETS) return err(503, 'asset storage not configured');
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err(400, 'Expected multipart form data');
  }
  const file = form.get('file');
  if (!isUploadFile(file) || file.size === 0) return err(400, 'Missing "file" field');
  if (file.size > ASSET_UPLOAD_LIMITS.maxBytes) {
    return err(413, `File too large — max ${ASSET_UPLOAD_LIMITS.maxBytes / 1024 / 1024} MB`);
  }
  const filename = file.name || 'sprite.png';
  const dot = filename.lastIndexOf('.');
  const ext = dot === -1 ? '' : filename.slice(dot).toLowerCase();
  if (!(ASSET_UPLOAD_LIMITS.allowedExt as readonly string[]).includes(ext)) {
    return err(400, `Unsupported file extension "${ext || '(none)'}" — use .png (28x36-pixel sprite sheet)`);
  }
  if (!(ASSET_UPLOAD_LIMITS.allowedMime as readonly string[]).includes(file.type)) {
    return err(400, `Unsupported MIME type "${file.type || 'unknown'}" — expected image/png`);
  }

  let id: string;
  const rawId = form.get('id');
  if (typeof rawId === 'string' && rawId.trim() !== '') {
    const p = ASSET_ID_SCHEMA.safeParse(rawId.trim());
    if (!p.success) return err(400, 'Invalid asset id', p.error.flatten());
    id = p.data;
  } else {
    const base = (dot === -1 ? filename : filename.slice(0, dot))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
    id = base || 'model';
  }
  const exists = await db.prepare('SELECT id FROM asset_manifest WHERE id = ?').bind(id).first();
  if (exists) return err(409, `Asset already exists: ${id}`);

  const attribution = String(form.get('attribution') ?? '');
  if (attribution.length > 300) return err(400, 'attribution too long (max 300 chars)');
  const license = String(form.get('license') ?? '');
  if (license.length > 100) return err(400, 'license too long (max 100 chars)');

  // animations: JSON object mapping animation name -> frame count,
  // e.g. {"idle":2,"walking":4}
  let animations: Record<string, number> = {};
  const rawAnims = form.get('animations');
  if (typeof rawAnims === 'string' && rawAnims.trim() !== '') {
    let parsedAnims: unknown;
    try {
      parsedAnims = JSON.parse(rawAnims);
    } catch {
      return err(400, 'Invalid animations JSON');
    }
    const ap = z
      .record(z.string().max(32), z.number().int().min(1).max(64))
      .refine((o) => Object.keys(o).length <= 20, 'too many animations (max 20)')
      .safeParse(parsedAnims);
    if (!ap.success) return err(400, 'Invalid animations value', ap.error.flatten());
    animations = ap.data;
  }

  let frameWidth = 28;
  let frameHeight = 36;
  for (const [field, set] of [
    ['frameWidth', (v: number) => (frameWidth = v)],
    ['frameHeight', (v: number) => (frameHeight = v)],
  ] as const) {
    const raw = form.get(field);
    if (typeof raw === 'string' && raw.trim() !== '') {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 8 || n > 256) {
        return err(400, `Invalid ${field} (must be an integer 8..256)`);
      }
      set(n);
    }
  }

  const kind = 'png';
  const r2Key = `characters/${id}.png`;
  await env.ASSETS.put(r2Key, file, { httpMetadata: { contentType: file.type } });

  const base = (env.R2_PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const publicUrlConfigured = base.length > 0;
  const url = publicUrlConfigured ? `${base}/${r2Key}` : r2Key;
  const now = new Date().toISOString();
  await db
    .prepare(insertSql('asset_manifest', ASSET_COLS))
    .bind(
      id,
      url,
      kind,
      attribution,
      license,
      JSON.stringify({ hairColor: false, eyeColor: false, outfit: false, accessories: false }),
      JSON.stringify(animations),
      frameWidth,
      frameHeight,
      now,
    )
    .run();
  await audit(db, {
    actor,
    action: 'asset.upload',
    entity: 'asset',
    entityId: id,
    detail: { key: r2Key, kind, bytes: file.size },
    ip: clientIp(request),
  });
  const row = await db.prepare(`SELECT ${ASSET_COLS} FROM asset_manifest WHERE id = ?`).bind(id).first<Row>();
  return json({ asset: mapAssetRow(row ?? {}), publicUrlConfigured }, 201);
}

async function deleteAsset(
  db: D1Database,
  id: string,
  request: Request,
  env: Env,
  actor: string,
): Promise<Response> {
  if (!env.ASSETS) return err(503, 'asset storage not configured');
  const row = await db.prepare(`SELECT ${ASSET_COLS} FROM asset_manifest WHERE id = ?`).bind(id).first<Row>();
  if (!row) return err(404, `Unknown asset: ${id}`);
  await env.ASSETS.delete(`characters/${id}.png`);
  await db.prepare('DELETE FROM asset_manifest WHERE id = ?').bind(id).run();
  await audit(db, {
    actor,
    action: 'asset.delete',
    entity: 'asset',
    entityId: id,
    ip: clientIp(request),
  });
  return json({ ok: true });
}

// ------------------------------------------------------------ error events

const ERROR_EVENT_COLS =
  'id, agent_id, category, message, status, created_at, resolved_at';

async function listErrorEvents(db: D1Database, url: URL): Promise<Response> {
  const status = url.searchParams.get('status');
  const sql = status
    ? `SELECT ${ERROR_EVENT_COLS} FROM error_events WHERE status = ? ORDER BY created_at DESC`
    : `SELECT ${ERROR_EVENT_COLS} FROM error_events ORDER BY created_at DESC`;
  const stmt = db.prepare(sql);
  const { results } = status
    ? await stmt.bind(status).all<Row>()
    : await stmt.bind().all<Row>();
  return json({ events: results.map(mapErrorEventRow) });
}

async function createErrorEvent(
  db: D1Database,
  request: Request,
  env: Env,
  actor: string,
): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return err(400, 'Invalid JSON body');
  const parsed = ErrorEventCreateSchema.safeParse(body.value);
  if (!parsed.success) return err(400, 'Invalid error event payload', parsed.error.flatten());
  const id = `err_${randomHex(12)}`;
  const now = new Date().toISOString();
  await db
    .prepare(insertSql('error_events', ERROR_EVENT_COLS))
    .bind(
      id,
      parsed.data.agentId,
      parsed.data.category,
      parsed.data.message,
      'open',
      now,
      null,
    )
    .run();
  await audit(db, {
    actor,
    action: 'errorEvent.create',
    entity: 'errorEvent',
    entityId: id,
    detail: { agentId: parsed.data.agentId, category: parsed.data.category },
    ip: clientIp(request),
  });
  await notifyClients(env, 'errorEvents.update');
  const row = await db
    .prepare(`SELECT ${ERROR_EVENT_COLS} FROM error_events WHERE id = ?`)
    .bind(id)
    .first<Row>();
  return json({ event: mapErrorEventRow(row ?? {}) }, 201);
}

async function patchErrorEvent(
  db: D1Database,
  id: string,
  request: Request,
  env: Env,
  actor: string,
): Promise<Response> {
  const row = await db
    .prepare(`SELECT ${ERROR_EVENT_COLS} FROM error_events WHERE id = ?`)
    .bind(id)
    .first<Row>();
  if (!row) return err(404, `Unknown error event: ${id}`);
  const body = await readJson(request);
  if (!body.ok) return err(400, 'Invalid JSON body');
  const parsed = ErrorEventUpdateSchema.safeParse(body.value);
  if (!parsed.success) return err(400, 'Invalid error event payload', parsed.error.flatten());
  const event = mapErrorEventRow(row);
  const { status: to, note } = parsed.data;
  if (!canTransitionErrorEvent(event.status, to)) {
    return err(422, `Cannot transition error event from "${event.status}" to "${to}"`);
  }
  const now = new Date().toISOString();
  const resolvedAt = to === 'resolved' ? now : event.resolvedAt;
  await db
    .prepare('UPDATE error_events SET status = ?, resolved_at = ? WHERE id = ?')
    .bind(to, resolvedAt, id)
    .run();
  await audit(db, {
    actor,
    action: 'errorEvent.transition',
    entity: 'errorEvent',
    entityId: id,
    detail: { from: event.status, to, note },
    ip: clientIp(request),
  });
  await notifyClients(env, 'errorEvents.update');
  const updated = await db
    .prepare(`SELECT ${ERROR_EVENT_COLS} FROM error_events WHERE id = ?`)
    .bind(id)
    .first<Row>();
  return json({ event: mapErrorEventRow(updated ?? {}) });
}

// -------------------------------------------------------------------- audit

async function listAudit(db: D1Database, url: URL): Promise<Response> {  let limit = 50;
  const raw = url.searchParams.get('limit');
  if (raw !== null) {
    const n = Number.parseInt(raw, 10);
    if (Number.isInteger(n) && n > 0) limit = Math.min(n, 200);
  }
  const { results } = await db
    .prepare('SELECT id, at, actor, action, entity, entity_id, detail, ip FROM audit_log ORDER BY at DESC LIMIT ?')
    .bind(limit)
    .all<Row>();
  return json({ entries: results.map(mapAuditRow) });
}

// ------------------------------------------------------------------- public

/** Public config keys exposed without auth (renamed for the storefront). */
const PUBLIC_CONFIG_MAP = {
  branding: 'office.branding',
  theme: 'office.theme',
  visibility: 'office.visibility',
  camera: 'office.camera',
} as const;

async function publicConfig(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare('SELECT key, value, updated_at, updated_by FROM office_config')
    .bind()
    .all<Row>();
  const values: Record<string, unknown> = {};
  for (const row of results) {
    try {
      values[String(row.key)] = JSON.parse(String(row.value));
    } catch {
      // Corrupt row — fall through to the default below.
    }
  }
  const out: Record<string, unknown> = {};
  for (const [outKey, cfgKey] of Object.entries(PUBLIC_CONFIG_MAP)) {
    const schema = OFFICE_CONFIG_SCHEMAS[cfgKey as OfficeConfigKey] as z.ZodTypeAny;
    let parsed: unknown;
    try {
      parsed = schema.parse(values[cfgKey]);
    } catch {
      // 404-safe defaults when the key was never configured.
      parsed = schema.parse(cfgKey === 'office.theme' ? 'midnight' : {});
    }
    out[outKey] = parsed;
  }
  return json(out);
}

function mapPublicWorker(row: Row): PublicWorker {
  const w = mapWorkerRow(row);
  return PublicWorkerSchema.parse({
    id: w.id,
    displayName: w.displayName,
    role: w.role,
    description: w.description,
    status: w.status,
    lastSeen: w.lastSeen,
    currentTask: w.currentTask,
    workstationId: w.workstationId,
    characterModel: w.characterModel,
    characterConfig: w.characterConfig,
    accentColor: w.accentColor,
    animationProfile: w.animationProfile,
    services: w.services,
    sortOrder: w.sortOrder,
  });
}

async function publicWorkers(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare(
      `SELECT ${WORKER_COLS} FROM workers WHERE public_visible = ? AND archived = ? ORDER BY sort_order ASC`,
    )
    .bind(1, 0)
    .all<Row>();
  // agentSource / customerContact etc. never leave the server on this path.
  return json({ workers: results.map(mapPublicWorker) });
}

async function publicServices(db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare(`SELECT ${SERVICE_COLS} FROM services WHERE status = ? ORDER BY sort_order ASC`)
    .bind('published')
    .all<Row>();
  const wrows = await db.prepare('SELECT id, display_name FROM workers').bind().all<Row>();
  const names = new Map<string, string>();
  for (const w of wrows.results) names.set(String(w.id), String(w.display_name));
  const services = results.map((r) => {
    const s = mapServiceRow(r);
    return {
      ...PublicServiceSchema.parse(s),
      workerName: s.workerId ? (names.get(s.workerId) ?? null) : null,
    };
  });
  return json({ services });
}

// --------------------------------------------------------------- dispatch

async function handleAdmin(request: Request, env: Env): Promise<Response> {
  const db = env.DB;
  if (!db) return err(503, 'admin database not configured');
  const url = new URL(request.url);
  const segs = splitSegments(url.pathname, '/api/admin');
  const method = request.method;
  const [head, id, tail] = segs;

  // Auth endpoints: no session required.
  if (head === 'auth') {
    if (id === 'setup' && method === 'POST') return handleSetup(request, env);
    if (id === 'login' && method === 'POST') return handleLogin(request, env);
    if (id === 'logout' && method === 'POST') return handleLogout(request, env);
    if (id === 'me' && method === 'GET') return handleMe(request, env);
    return err(404, 'Not found');
  }

  const authed = await requireAdmin(request, env);
  if (!authed) return err(401, 'Authentication required');
  const actor = authed.user.username;
  // 'viewer' may read; only 'admin' may mutate.
  const isRead = method === 'GET' || method === 'HEAD';
  if (!isRead && !requireRole(authed.user, 'admin')) {
    return err(403, 'Insufficient role');
  }

  if (head === 'workers') {
    if (!id) {
      if (method === 'GET') return listWorkers(db, url);
      if (method === 'POST') return createWorker(db, request, env, actor);
    } else if (!tail) {
      if (method === 'GET') return getWorker(db, id);
      if (method === 'PUT') return updateWorker(db, id, request, env, actor);
      if (method === 'DELETE') return archiveWorker(db, id, request, env, actor);
    } else if (tail === 'restore' && method === 'POST') {
      return restoreWorker(db, id, request, env, actor);
    }
    return err(404, 'Not found');
  }

  if (head === 'services') {
    if (!id) {
      if (method === 'GET') return listServices(db);
      if (method === 'POST') return createService(db, request, env, actor);
    } else if (!tail) {
      if (method === 'GET') return getService(db, id);
      if (method === 'PUT') return updateService(db, id, request, env, actor);
      if (method === 'DELETE') return deleteService(db, id, request, env, actor);
    }
    return err(404, 'Not found');
  }

  if (head === 'orders') {
    if (!id) {
      if (method === 'GET') return listOrders(db);
      if (method === 'POST') return createOrder(db, request, actor);
    } else if (!tail) {
      if (method === 'GET') return getOrder(db, id);
    } else if (tail === 'transition' && method === 'POST') {
      return transitionOrder(db, id, request, actor);
    } else if (tail === 'payment' && method === 'POST') {
      return recordOrderPayment(db, id, request, actor);
    }
    return err(404, 'Not found');
  }

  if (head === 'config') {
    if (!id) {
      if (method === 'GET') return listConfig(db);
    } else if (!tail && method === 'PUT') {
      return putConfig(db, id, request, env, actor);
    }
    return err(404, 'Not found');
  }

  if (head === 'assets') {
    if (!id) {
      if (method === 'GET') return listAssets(db);
      if (method === 'POST') return uploadAsset(db, request, env, actor);
    } else if (!tail && method === 'DELETE') {
      return deleteAsset(db, id, request, env, actor);
    }
    return err(404, 'Not found');
  }

  if (head === 'audit' && !id && method === 'GET') {
    return listAudit(db, url);
  }

  if (head === 'error-events') {
    if (!id) {
      if (method === 'GET') return listErrorEvents(db, url);
      if (method === 'POST') return createErrorEvent(db, request, env, actor);
    } else if (!tail && method === 'PATCH') {
      return patchErrorEvent(db, id, request, env, actor);
    }
    return err(404, 'Not found');
  }

  return err(404, 'Not found');
}

async function handlePublic(request: Request, env: Env): Promise<Response> {
  const db = env.DB;
  if (!db) return err(503, 'admin database not configured');
  const url = new URL(request.url);
  const segs = splitSegments(url.pathname, '/api/public');
  if (request.method !== 'GET') return err(405, 'Method not allowed');
  const [head] = segs;
  if (segs.length === 1) {
    if (head === 'config') return publicConfig(db);
    if (head === 'workers') return publicWorkers(db);
    if (head === 'services') return publicServices(db);
  }
  return err(404, 'Not found');
}

/**
 * Entry point used by src/index.ts. Intercepts /api/admin/* and /api/public/*;
 * everything else is forwarded to the AgentRoom DO by the caller.
 */
export async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname;
  const isAdmin = path === '/api/admin' || path.startsWith('/api/admin/');
  const isPublic = path === '/api/public' || path.startsWith('/api/public/');
  if (!isAdmin && !isPublic) return err(404, 'Not found');
  if (!env.DB) {
    // Honest degradation: the worker runs fine without D1 — only the
    // admin/storefront API is unavailable.
    return err(503, 'admin database not configured');
  }
  if (isAdmin) {
    const limited = enforceRateLimit(request);
    if (limited) return limited;
    return handleAdmin(request, env);
  }
  return handlePublic(request, env);
}
