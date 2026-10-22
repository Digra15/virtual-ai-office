/**
 * Admin domain contracts for the Virtual AI Office.
 *
 * Zod schemas + types for workers, services, orders, office configuration,
 * character assets, auth, and audit logging. The Cloudflare Worker validates
 * every admin mutation against these; the /admin frontend builds its forms
 * from them. Keep in sync with `apps/worker/migrations/*.sql`.
 */
import { z } from 'zod';
import { RecoveryConfigSchema } from './building';

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

/** Roles a worker can hold (display purposes; not a permission). */
export const WORKER_ROLES = [
  'assistant',
  'research',
  'coding',
  'writing',
  'design',
  'data',
  'automation',
  'monitoring',
  'qa',
  'custom',
] as const;
export type WorkerRole = (typeof WORKER_ROLES)[number];

/** Animation profiles selectable in the admin panel. */
export const ANIMATION_PROFILES = ['default', 'calm', 'energetic', 'formal'] as const;
export type AnimationProfile = (typeof ANIMATION_PROFILES)[number];

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color like "#rrggbb"');

/**
 * A worker record. `id` is the stable integration identity — it NEVER
 * changes, even when `displayName` is edited. `agentSource` is the
 * underlying agent/connector identifier; renaming or deleting a worker
 * record must never terminate the underlying AI agent.
 */
export const WorkerSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/i, 'id must be URL-safe'),
  displayName: z.string().min(1).max(80),
  role: z.enum(WORKER_ROLES),
  description: z.string().max(2000).default(''),
  /** Stable integration identity of the underlying agent (opaque to admin). */
  agentSource: z.string().max(200).default(''),
  status: z.string().max(32).default('offline'),
  lastSeen: z.string().datetime().nullable().default(null),
  currentTask: z.string().max(500).default(''),
  workstationId: z.string().max(32).default(''),
  publicVisible: z.boolean().default(true),
  characterModel: z.string().max(64).default('procedural-pixel'),
  /** JSON-serializable CharacterPreset (validated client-side too). */
  characterConfig: z.record(z.string(), z.unknown()).default({}),
  accentColor: HexColorSchema.default('#38bdf8'),
  animationProfile: z.enum(ANIMATION_PROFILES).default('default'),
  /** Service ids this worker offers. */
  services: z.array(z.string().max(64)).default([]),
  sortOrder: z.number().int().default(0),
  displaySettings: z.record(z.string(), z.unknown()).default({}),
  archived: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Worker = z.infer<typeof WorkerSchema>;

export const WorkerCreateSchema = WorkerSchema.omit({ createdAt: true, updatedAt: true }).partial({
  role: true,
  description: true,
  agentSource: true,
  status: true,
  lastSeen: true,
  currentTask: true,
  workstationId: true,
  publicVisible: true,
  characterModel: true,
  characterConfig: true,
  accentColor: true,
  animationProfile: true,
  services: true,
  sortOrder: true,
  displaySettings: true,
  archived: true,
});
export type WorkerCreate = z.infer<typeof WorkerCreateSchema>;

/**
 * Updates must never change `id` or `agentSource` — renaming a worker is a
 * display-only operation. The server enforces this by stripping those keys.
 */
export const WorkerUpdateSchema = WorkerCreateSchema.omit({ id: true, agentSource: true }).partial();
export type WorkerUpdate = z.infer<typeof WorkerUpdateSchema>;

/** Public view: only approved fields, non-public/archived workers excluded server-side. */
export const PublicWorkerSchema = WorkerSchema.pick({
  id: true,
  displayName: true,
  role: true,
  description: true,
  status: true,
  lastSeen: true,
  currentTask: true,
  workstationId: true,
  characterModel: true,
  characterConfig: true,
  accentColor: true,
  animationProfile: true,
  services: true,
  sortOrder: true,
});
export type PublicWorker = z.infer<typeof PublicWorkerSchema>;

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export const SERVICE_STATUSES = ['draft', 'published'] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const PortfolioItemSchema = z.object({
  title: z.string().min(1).max(120),
  url: z.string().url().max(500),
  imageUrl: z.string().url().max(500).optional(),
});
export type PortfolioItem = z.infer<typeof PortfolioItemSchema>;

export const ServiceSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/i),
  title: z.string().min(1).max(120),
  description: z.string().max(5000).default(''),
  workerId: z.string().max(64).nullable().default(null),
  price: z.number().min(0).max(1_000_000_000).default(0),
  currency: z.string().min(3).max(3).default('USD'),
  deliveryEstimate: z.string().max(300).default(''),
  inputRequirements: z.string().max(2000).default(''),
  revisionPolicy: z.string().max(2000).default(''),
  status: z.enum(SERVICE_STATUSES).default('draft'),
  portfolio: z.array(PortfolioItemSchema).max(20).default([]),
  /** Required disclosure when work is AI-generated or needs human review. */
  aiDisclosure: z.string().max(2000).default(''),
  sortOrder: z.number().int().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Service = z.infer<typeof ServiceSchema>;

export const ServiceCreateSchema = ServiceSchema.omit({ createdAt: true, updatedAt: true }).partial({
  description: true,
  workerId: true,
  price: true,
  currency: true,
  deliveryEstimate: true,
  inputRequirements: true,
  revisionPolicy: true,
  status: true,
  portfolio: true,
  aiDisclosure: true,
  sortOrder: true,
});
export type ServiceCreate = z.infer<typeof ServiceCreateSchema>;
export const ServiceUpdateSchema = ServiceCreateSchema.omit({ id: true }).partial();
export type ServiceUpdate = z.infer<typeof ServiceUpdateSchema>;

export const PublicServiceSchema = ServiceSchema.omit({}).extend({});
export type PublicService = z.infer<typeof PublicServiceSchema>;

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const ORDER_STATES = [
  'pending',
  'accepted',
  'queued',
  'in_progress',
  'review',
  'completed',
  'cancelled',
  'failed',
] as const;
export type OrderState = (typeof ORDER_STATES)[number];

/** Allowed state transitions. Terminal states have no outgoing edges. */
export const ORDER_TRANSITIONS: Record<OrderState, OrderState[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['queued', 'cancelled'],
  queued: ['in_progress', 'cancelled'],
  in_progress: ['review', 'failed', 'cancelled'],
  review: ['completed', 'in_progress', 'failed'],
  completed: [],
  cancelled: [],
  failed: ['queued'],
};

export function canTransitionOrder(from: OrderState, to: OrderState): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export const REVIEW_STATES = ['none', 'pending', 'approved', 'rejected'] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const AttachmentSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().max(1000),
  mime: z.string().max(100).default('application/octet-stream'),
  size: z.number().int().min(0).max(100_000_000).default(0),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const DeliverableSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url().max(1000),
  note: z.string().max(1000).default(''),
  at: z.string().datetime(),
});
export type Deliverable = z.infer<typeof DeliverableSchema>;

export const OrderSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/i),
  customerName: z.string().max(120).default(''),
  /** Private contact — admin eyes only, never exposed publicly. */
  customerContact: z.string().max(200).default(''),
  serviceId: z.string().min(1).max(64),
  /** Customer brief. NEVER executed as code — treated as plain text. */
  brief: z.string().max(20_000).default(''),
  attachments: z.array(AttachmentSchema).max(20).default([]),
  status: z.enum(ORDER_STATES).default('pending'),
  workerId: z.string().max(64).nullable().default(null),
  /**
   * Payment flag. May ONLY be set through the verified payment path
   * (POST /api/admin/orders/:id/payment with provider + providerRef).
   * Normal order updates can never flip this.
   */
  paid: z.boolean().default(false),
  paymentRef: z.string().max(200).nullable().default(null),
  deliverables: z.array(DeliverableSchema).max(50).default([]),
  reviewState: z.enum(REVIEW_STATES).default('none'),
  reviewNote: z.string().max(2000).default(''),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().default(null),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderCreateSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/i).optional(),
  customerName: z.string().max(120).default(''),
  customerContact: z.string().max(200).default(''),
  serviceId: z.string().min(1).max(64),
  brief: z.string().max(20_000).default(''),
  attachments: z.array(AttachmentSchema).max(20).default([]),
  workerId: z.string().max(64).nullable().default(null),
});
export type OrderCreate = z.infer<typeof OrderCreateSchema>;

export const OrderTransitionSchema = z.object({
  to: z.enum(ORDER_STATES),
  note: z.string().max(1000).default(''),
});
export type OrderTransition = z.infer<typeof OrderTransitionSchema>;

export const OrderPaymentSchema = z.object({
  /** Payment provider name, e.g. "stripe". */
  provider: z.string().min(1).max(64),
  /** Provider-side reference (charge/payment-intent id). */
  providerRef: z.string().min(1).max(200),
});
export type OrderPayment = z.infer<typeof OrderPaymentSchema>;

// ---------------------------------------------------------------------------
// Office configuration
// ---------------------------------------------------------------------------

/** Theme presets for the office chrome (2D dashboard + 3D accents). */
export const THEME_PRESETS = ['midnight', 'dawn', 'forest', 'mono'] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

export const RoomConfigSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  description: z.string().max(500).default(''),
  visible: z.boolean().default(true),
});
export type RoomConfig = z.infer<typeof RoomConfigSchema>;

export const WorkstationConfigSchema = z.object({
  id: z.string().min(1).max(64),
  /** [x, z] floor position in scene units. */
  position: z.tuple([z.number(), z.number()]),
  rotationY: z.number().default(0),
  label: z.string().max(80).default(''),
  enabled: z.boolean().default(true),
});
export type WorkstationConfig = z.infer<typeof WorkstationConfigSchema>;

export const BrandingConfigSchema = z.object({
  officeName: z.string().min(1).max(80).default('Virtual AI Office'),
  tagline: z.string().max(160).default('AI Team. Real Work. Real Value.'),
  logoUrl: z.string().url().max(1000).or(z.literal('')).default(''),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#38bdf8'),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#818cf8'),
});
export type BrandingConfig = z.infer<typeof BrandingConfigSchema>;

export const CameraDefaultsSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]).default([16, 13, 16]),
  target: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  fov: z.number().min(20).max(90).default(45),
});
export type CameraDefaults = z.infer<typeof CameraDefaultsSchema>;

/** Validated office-config keys and their value schemas. */
export const OFFICE_CONFIG_SCHEMAS = {
  'office.branding': BrandingConfigSchema,
  'office.theme': z.enum(THEME_PRESETS),
  'office.rooms': z.array(RoomConfigSchema).max(20),
  'office.workstations': z.array(WorkstationConfigSchema).max(60),
  /** workerId -> workstationId assignments. */
  'office.assignments': z.record(z.string(), z.string()),
  /** Recovery workflow: auto-recovery of errored agents to recovery beds. */
  'office.recovery': RecoveryConfigSchema,
  'office.visibility': z.object({
    publicScene: z.boolean().default(true),
    showOffline: z.boolean().default(true),
  }),
  'office.camera': CameraDefaultsSchema,
} as const;
export type OfficeConfigKey = keyof typeof OFFICE_CONFIG_SCHEMAS;

// ---------------------------------------------------------------------------
// Character assets
// ---------------------------------------------------------------------------

export const AssetSupportSchema = z.object({
  hairColor: z.boolean().default(false),
  eyeColor: z.boolean().default(false),
  outfit: z.boolean().default(false),
  accessories: z.boolean().default(false),
});
export type AssetSupport = z.infer<typeof AssetSupportSchema>;

export const AssetManifestEntrySchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/i),
  url: z.string().url().max(1000),
  kind: z.enum(['png']).default('png'),
  attribution: z.string().max(300).default(''),
  license: z.string().max(100).default(''),
  supports: AssetSupportSchema.default({
    hairColor: false,
    eyeColor: false,
    outfit: false,
    accessories: false,
  }),
  /** Animation name -> frame count for the PNG sprite sheet. */
  animations: z
    .record(z.string().max(32), z.number().int().min(1).max(64))
    .default({}),
  /** Frame dimensions in pixels (built-in sprites are 28x36). */
  frameWidth: z.number().int().min(8).max(256).default(28),
  frameHeight: z.number().int().min(8).max(256).default(36),
  createdAt: z.string().datetime(),
});
export type AssetManifestEntry = z.infer<typeof AssetManifestEntrySchema>;

/** Server-side upload validation (mirrored client-side for UX). */
export const ASSET_UPLOAD_LIMITS = {
  maxBytes: 5 * 1024 * 1024, // 5 MB
  allowedMime: ['image/png'],
  allowedExt: ['.png'],
} as const;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const ADMIN_ROLES = ['admin', 'viewer'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const AdminSetupSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-z0-9_-]+$/i),
  password: z.string().min(12).max(200),
  setupToken: z.string().min(1).max(200),
});
export type AdminSetup = z.infer<typeof AdminSetupSchema>;

export const AdminLoginSchema = z.object({
  username: z.string().min(1).max(32),
  password: z.string().min(1).max(200),
});
export type AdminLogin = z.infer<typeof AdminLoginSchema>;

export const AdminUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.enum(ADMIN_ROLES),
  createdAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const AuditEntrySchema = z.object({
  id: z.string(),
  at: z.string().datetime(),
  actor: z.string().max(64),
  action: z.string().max(64),
  entity: z.string().max(32),
  entityId: z.string().max(64),
  detail: z.record(z.string(), z.unknown()).default({}),
  ip: z.string().max(64).nullable().default(null),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

// ---------------------------------------------------------------------------
// API surface (paths + client helpers)
// ---------------------------------------------------------------------------

export const ADMIN_API = {
  setup: '/api/admin/auth/setup',
  login: '/api/admin/auth/login',
  logout: '/api/admin/auth/logout',
  me: '/api/admin/auth/me',
  workers: '/api/admin/workers',
  worker: (id: string) => `/api/admin/workers/${encodeURIComponent(id)}`,
  services: '/api/admin/services',
  service: (id: string) => `/api/admin/services/${encodeURIComponent(id)}`,
  orders: '/api/admin/orders',
  order: (id: string) => `/api/admin/orders/${encodeURIComponent(id)}`,
  orderTransition: (id: string) => `/api/admin/orders/${encodeURIComponent(id)}/transition`,
  orderPayment: (id: string) => `/api/admin/orders/${encodeURIComponent(id)}/payment`,
  config: '/api/admin/config',
  configKey: (key: string) => `/api/admin/config/${encodeURIComponent(key)}`,
  errorEvents: '/api/admin/error-events',
  errorEvent: (id: string) => `/api/admin/error-events/${encodeURIComponent(id)}`,
  assets: '/api/admin/assets',
  asset: (id: string) => `/api/admin/assets/${encodeURIComponent(id)}`,
  audit: '/api/admin/audit',
} as const;

export const PUBLIC_API = {
  config: '/api/public/config',
  workers: '/api/public/workers',
  services: '/api/public/services',
} as const;

/** Live-update message types broadcast by the Worker on admin changes. */
export const ADMIN_BROADCAST_TYPES = [
  'config.update',
  'workers.update',
  'services.update',
  'errorEvents.update',
] as const;
export type AdminBroadcastType = (typeof ADMIN_BROADCAST_TYPES)[number];
