/**
 * Admin DB helpers: D1 snake_case rows -> camelCase shared types, audit
 * logging, and small shared utilities (random ids, client IP).
 *
 * D1 rows come back as `Record<string, unknown>` with the column names from
 * migrations/0001_admin.sql. Every mapper below converts one row into the
 * matching type from @virtual-ai-office/shared.
 */
import type {
  AdminUser,
  AssetManifestEntry,
  AuditEntry,
  ErrorEvent,
  Order,
  Service,
  Worker,
} from '@virtual-ai-office/shared';

/** A raw D1 row. */
export type Row = Record<string, unknown>;

/** Cryptographically random hex string (`bytes` raw bytes). */
export function randomHex(bytes: number): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  let out = '';
  for (const x of b) out += x.toString(16).padStart(2, '0');
  return out;
}

/** Best-effort client IP (Cloudflare header first). */
export function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || raw === '') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const toBool = (v: unknown): boolean => v === 1 || v === true;

export function mapAdminUserRow(row: Row): AdminUser {
  return {
    id: String(row.id),
    username: String(row.username),
    role: row.role === 'admin' ? 'admin' : 'viewer',
    createdAt: String(row.created_at),
    lastLoginAt: (row.last_login_at as string | null) ?? null,
  };
}

export function mapWorkerRow(row: Row): Worker {
  return {
    id: String(row.id),
    displayName: String(row.display_name ?? ''),
    role: (row.role ?? 'assistant') as Worker['role'],
    description: String(row.description ?? ''),
    agentSource: String(row.agent_source ?? ''),
    status: String(row.status ?? 'offline'),
    lastSeen: (row.last_seen as string | null) ?? null,
    currentTask: String(row.current_task ?? ''),
    workstationId: String(row.workstation_id ?? ''),
    publicVisible: toBool(row.public_visible),
    characterModel: String(row.character_model ?? 'procedural-pixel'),
    characterConfig: parseJson<Record<string, unknown>>(row.character_config, {}),
    accentColor: String(row.accent_color ?? '#38bdf8'),
    animationProfile: (row.animation_profile ?? 'default') as Worker['animationProfile'],
    services: parseJson<string[]>(row.services, []),
    sortOrder: Number(row.sort_order ?? 0),
    displaySettings: parseJson<Record<string, unknown>>(row.display_settings, {}),
    archived: toBool(row.archived),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapServiceRow(row: Row): Service {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    workerId: (row.worker_id as string | null) ?? null,
    price: Number(row.price ?? 0),
    currency: String(row.currency ?? 'USD'),
    deliveryEstimate: String(row.delivery_estimate ?? ''),
    inputRequirements: String(row.input_requirements ?? ''),
    revisionPolicy: String(row.revision_policy ?? ''),
    status: (row.status ?? 'draft') as Service['status'],
    portfolio: parseJson<Service['portfolio']>(row.portfolio, []),
    aiDisclosure: String(row.ai_disclosure ?? ''),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapOrderRow(row: Row): Order {
  return {
    id: String(row.id),
    customerName: String(row.customer_name ?? ''),
    customerContact: String(row.customer_contact ?? ''),
    serviceId: String(row.service_id ?? ''),
    brief: String(row.brief ?? ''),
    attachments: parseJson<Order['attachments']>(row.attachments, []),
    status: (row.status ?? 'pending') as Order['status'],
    workerId: (row.worker_id as string | null) ?? null,
    paid: toBool(row.paid),
    paymentRef: (row.payment_ref as string | null) ?? null,
    deliverables: parseJson<Order['deliverables']>(row.deliverables, []),
    reviewState: (row.review_state ?? 'none') as Order['reviewState'],
    reviewNote: String(row.review_note ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: (row.completed_at as string | null) ?? null,
  };
}

export function mapAssetRow(row: Row): AssetManifestEntry {
  return {
    id: String(row.id),
    url: String(row.url ?? ''),
    kind: 'png',
    attribution: String(row.attribution ?? ''),
    license: String(row.license ?? ''),
    supports: parseJson<AssetManifestEntry['supports']>(row.supports, {
      hairColor: false,
      eyeColor: false,
      outfit: false,
      accessories: false,
    }),
    animations: parseJson<Record<string, number>>(row.animations, {}),
    frameWidth: Number(row.frame_width ?? 28),
    frameHeight: Number(row.frame_height ?? 36),
    createdAt: String(row.created_at),
  };
}

export function mapAuditRow(row: Row): AuditEntry {
  return {
    id: String(row.id),
    at: String(row.at),
    actor: String(row.actor ?? ''),
    action: String(row.action ?? ''),
    entity: String(row.entity ?? ''),
    entityId: String(row.entity_id ?? ''),
    detail: parseJson<Record<string, unknown>>(row.detail, {}),
    ip: (row.ip as string | null) ?? null,
  };
}

export function mapErrorEventRow(row: Row): ErrorEvent {
  return {
    id: String(row.id),
    agentId: String(row.agent_id ?? ''),
    category: (row.category ?? 'unknown') as ErrorEvent['category'],
    message: String(row.message ?? ''),
    status: (row.status ?? 'open') as ErrorEvent['status'],
    createdAt: String(row.created_at),
    resolvedAt: (row.resolved_at as string | null) ?? null,
  };
}

export interface AuditInput {
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  detail?: Record<string, unknown>;
  ip?: string | null;
}

/** Append one audit row. Fire-and-forget safe: callers may await or not. */
export async function audit(db: D1Database, entry: AuditInput): Promise<void> {
  await db
    .prepare(
      'INSERT INTO audit_log (id, at, actor, action, entity, entity_id, detail, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      `aud_${randomHex(12)}`,
      new Date().toISOString(),
      entry.actor,
      entry.action,
      entry.entity,
      entry.entityId,
      JSON.stringify(entry.detail ?? {}),
      entry.ip ?? null,
    )
    .run();
}
