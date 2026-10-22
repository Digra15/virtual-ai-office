"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_BROADCAST_TYPES = exports.PUBLIC_API = exports.ADMIN_API = exports.AuditEntrySchema = exports.AdminUserSchema = exports.AdminLoginSchema = exports.AdminSetupSchema = exports.ADMIN_ROLES = exports.ASSET_UPLOAD_LIMITS = exports.AssetManifestEntrySchema = exports.AssetSupportSchema = exports.OFFICE_CONFIG_SCHEMAS = exports.CameraDefaultsSchema = exports.BrandingConfigSchema = exports.WorkstationConfigSchema = exports.RoomConfigSchema = exports.THEME_PRESETS = exports.OrderPaymentSchema = exports.OrderTransitionSchema = exports.OrderCreateSchema = exports.OrderSchema = exports.DeliverableSchema = exports.AttachmentSchema = exports.REVIEW_STATES = exports.ORDER_TRANSITIONS = exports.ORDER_STATES = exports.PublicServiceSchema = exports.ServiceUpdateSchema = exports.ServiceCreateSchema = exports.ServiceSchema = exports.PortfolioItemSchema = exports.SERVICE_STATUSES = exports.PublicWorkerSchema = exports.WorkerUpdateSchema = exports.WorkerCreateSchema = exports.WorkerSchema = exports.ANIMATION_PROFILES = exports.WORKER_ROLES = void 0;
exports.canTransitionOrder = canTransitionOrder;
/**
 * Admin domain contracts for the Virtual AI Office.
 *
 * Zod schemas + types for workers, services, orders, office configuration,
 * character assets, auth, and audit logging. The Cloudflare Worker validates
 * every admin mutation against these; the /admin frontend builds its forms
 * from them. Keep in sync with `apps/worker/migrations/*.sql`.
 */
const zod_1 = require("zod");
// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------
/** Roles a worker can hold (display purposes; not a permission). */
exports.WORKER_ROLES = [
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
];
/** Animation profiles selectable in the admin panel. */
exports.ANIMATION_PROFILES = ['default', 'calm', 'energetic', 'formal'];
const HexColorSchema = zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color like "#rrggbb"');
/**
 * A worker record. `id` is the stable integration identity — it NEVER
 * changes, even when `displayName` is edited. `agentSource` is the
 * underlying agent/connector identifier; renaming or deleting a worker
 * record must never terminate the underlying AI agent.
 */
exports.WorkerSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/i, 'id must be URL-safe'),
    displayName: zod_1.z.string().min(1).max(80),
    role: zod_1.z.enum(exports.WORKER_ROLES),
    description: zod_1.z.string().max(2000).default(''),
    /** Stable integration identity of the underlying agent (opaque to admin). */
    agentSource: zod_1.z.string().max(200).default(''),
    status: zod_1.z.string().max(32).default('offline'),
    lastSeen: zod_1.z.string().datetime().nullable().default(null),
    currentTask: zod_1.z.string().max(500).default(''),
    workstationId: zod_1.z.string().max(32).default(''),
    publicVisible: zod_1.z.boolean().default(true),
    characterModel: zod_1.z.string().max(64).default('procedural-pixel'),
    /** JSON-serializable CharacterPreset (validated client-side too). */
    characterConfig: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).default({}),
    accentColor: HexColorSchema.default('#38bdf8'),
    animationProfile: zod_1.z.enum(exports.ANIMATION_PROFILES).default('default'),
    /** Service ids this worker offers. */
    services: zod_1.z.array(zod_1.z.string().max(64)).default([]),
    sortOrder: zod_1.z.number().int().default(0),
    displaySettings: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).default({}),
    archived: zod_1.z.boolean().default(false),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.WorkerCreateSchema = exports.WorkerSchema.omit({ createdAt: true, updatedAt: true }).partial({
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
/**
 * Updates must never change `id` or `agentSource` — renaming a worker is a
 * display-only operation. The server enforces this by stripping those keys.
 */
exports.WorkerUpdateSchema = exports.WorkerCreateSchema.omit({ id: true, agentSource: true }).partial();
/** Public view: only approved fields, non-public/archived workers excluded server-side. */
exports.PublicWorkerSchema = exports.WorkerSchema.pick({
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
// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
exports.SERVICE_STATUSES = ['draft', 'published'];
exports.PortfolioItemSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(120),
    url: zod_1.z.string().url().max(500),
    imageUrl: zod_1.z.string().url().max(500).optional(),
});
exports.ServiceSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/i),
    title: zod_1.z.string().min(1).max(120),
    description: zod_1.z.string().max(5000).default(''),
    workerId: zod_1.z.string().max(64).nullable().default(null),
    price: zod_1.z.number().min(0).max(1_000_000_000).default(0),
    currency: zod_1.z.string().min(3).max(3).default('USD'),
    deliveryEstimate: zod_1.z.string().max(300).default(''),
    inputRequirements: zod_1.z.string().max(2000).default(''),
    revisionPolicy: zod_1.z.string().max(2000).default(''),
    status: zod_1.z.enum(exports.SERVICE_STATUSES).default('draft'),
    portfolio: zod_1.z.array(exports.PortfolioItemSchema).max(20).default([]),
    /** Required disclosure when work is AI-generated or needs human review. */
    aiDisclosure: zod_1.z.string().max(2000).default(''),
    sortOrder: zod_1.z.number().int().default(0),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.ServiceCreateSchema = exports.ServiceSchema.omit({ createdAt: true, updatedAt: true }).partial({
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
exports.ServiceUpdateSchema = exports.ServiceCreateSchema.omit({ id: true }).partial();
exports.PublicServiceSchema = exports.ServiceSchema.omit({}).extend({});
// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
exports.ORDER_STATES = [
    'pending',
    'accepted',
    'queued',
    'in_progress',
    'review',
    'completed',
    'cancelled',
    'failed',
];
/** Allowed state transitions. Terminal states have no outgoing edges. */
exports.ORDER_TRANSITIONS = {
    pending: ['accepted', 'cancelled'],
    accepted: ['queued', 'cancelled'],
    queued: ['in_progress', 'cancelled'],
    in_progress: ['review', 'failed', 'cancelled'],
    review: ['completed', 'in_progress', 'failed'],
    completed: [],
    cancelled: [],
    failed: ['queued'],
};
function canTransitionOrder(from, to) {
    return exports.ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}
exports.REVIEW_STATES = ['none', 'pending', 'approved', 'rejected'];
exports.AttachmentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200),
    url: zod_1.z.string().url().max(1000),
    mime: zod_1.z.string().max(100).default('application/octet-stream'),
    size: zod_1.z.number().int().min(0).max(100_000_000).default(0),
});
exports.DeliverableSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    url: zod_1.z.string().url().max(1000),
    note: zod_1.z.string().max(1000).default(''),
    at: zod_1.z.string().datetime(),
});
exports.OrderSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/i),
    customerName: zod_1.z.string().max(120).default(''),
    /** Private contact — admin eyes only, never exposed publicly. */
    customerContact: zod_1.z.string().max(200).default(''),
    serviceId: zod_1.z.string().min(1).max(64),
    /** Customer brief. NEVER executed as code — treated as plain text. */
    brief: zod_1.z.string().max(20_000).default(''),
    attachments: zod_1.z.array(exports.AttachmentSchema).max(20).default([]),
    status: zod_1.z.enum(exports.ORDER_STATES).default('pending'),
    workerId: zod_1.z.string().max(64).nullable().default(null),
    /**
     * Payment flag. May ONLY be set through the verified payment path
     * (POST /api/admin/orders/:id/payment with provider + providerRef).
     * Normal order updates can never flip this.
     */
    paid: zod_1.z.boolean().default(false),
    paymentRef: zod_1.z.string().max(200).nullable().default(null),
    deliverables: zod_1.z.array(exports.DeliverableSchema).max(50).default([]),
    reviewState: zod_1.z.enum(exports.REVIEW_STATES).default('none'),
    reviewNote: zod_1.z.string().max(2000).default(''),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
    completedAt: zod_1.z.string().datetime().nullable().default(null),
});
exports.OrderCreateSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/i).optional(),
    customerName: zod_1.z.string().max(120).default(''),
    customerContact: zod_1.z.string().max(200).default(''),
    serviceId: zod_1.z.string().min(1).max(64),
    brief: zod_1.z.string().max(20_000).default(''),
    attachments: zod_1.z.array(exports.AttachmentSchema).max(20).default([]),
    workerId: zod_1.z.string().max(64).nullable().default(null),
});
exports.OrderTransitionSchema = zod_1.z.object({
    to: zod_1.z.enum(exports.ORDER_STATES),
    note: zod_1.z.string().max(1000).default(''),
});
exports.OrderPaymentSchema = zod_1.z.object({
    /** Payment provider name, e.g. "stripe". */
    provider: zod_1.z.string().min(1).max(64),
    /** Provider-side reference (charge/payment-intent id). */
    providerRef: zod_1.z.string().min(1).max(200),
});
// ---------------------------------------------------------------------------
// Office configuration
// ---------------------------------------------------------------------------
/** Theme presets for the office chrome (2D dashboard + 3D accents). */
exports.THEME_PRESETS = ['midnight', 'dawn', 'forest', 'mono'];
exports.RoomConfigSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64),
    name: zod_1.z.string().min(1).max(80),
    visible: zod_1.z.boolean().default(true),
});
exports.WorkstationConfigSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64),
    /** [x, z] floor position in scene units. */
    position: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]),
    rotationY: zod_1.z.number().default(0),
    label: zod_1.z.string().max(80).default(''),
    enabled: zod_1.z.boolean().default(true),
});
exports.BrandingConfigSchema = zod_1.z.object({
    officeName: zod_1.z.string().min(1).max(80).default('Virtual AI Office'),
    tagline: zod_1.z.string().max(160).default('AI Team. Real Work. Real Value.'),
    logoUrl: zod_1.z.string().url().max(1000).or(zod_1.z.literal('')).default(''),
    primaryColor: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#38bdf8'),
    accentColor: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#818cf8'),
});
exports.CameraDefaultsSchema = zod_1.z.object({
    position: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number(), zod_1.z.number()]).default([16, 13, 16]),
    target: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number(), zod_1.z.number()]).default([0, 0, 0]),
    fov: zod_1.z.number().min(20).max(90).default(45),
});
/** Validated office-config keys and their value schemas. */
exports.OFFICE_CONFIG_SCHEMAS = {
    'office.branding': exports.BrandingConfigSchema,
    'office.theme': zod_1.z.enum(exports.THEME_PRESETS),
    'office.rooms': zod_1.z.array(exports.RoomConfigSchema).max(20),
    'office.workstations': zod_1.z.array(exports.WorkstationConfigSchema).max(60),
    /** workerId -> workstationId assignments. */
    'office.assignments': zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
    'office.visibility': zod_1.z.object({
        publicScene: zod_1.z.boolean().default(true),
        showOffline: zod_1.z.boolean().default(true),
    }),
    'office.camera': exports.CameraDefaultsSchema,
};
// ---------------------------------------------------------------------------
// Character assets
// ---------------------------------------------------------------------------
exports.AssetSupportSchema = zod_1.z.object({
    hairColor: zod_1.z.boolean().default(false),
    eyeColor: zod_1.z.boolean().default(false),
    outfit: zod_1.z.boolean().default(false),
    accessories: zod_1.z.boolean().default(false),
});
exports.AssetManifestEntrySchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/i),
    url: zod_1.z.string().url().max(1000),
    kind: zod_1.z.enum(['png']).default('png'),
    attribution: zod_1.z.string().max(300).default(''),
    license: zod_1.z.string().max(100).default(''),
    supports: exports.AssetSupportSchema.default({
        hairColor: false,
        eyeColor: false,
        outfit: false,
        accessories: false,
    }),
    /** Animation name -> frame count for the PNG sprite sheet. */
    animations: zod_1.z
        .record(zod_1.z.string().max(32), zod_1.z.number().int().min(1).max(64))
        .default({}),
    /** Frame dimensions in pixels (built-in sprites are 28x36). */
    frameWidth: zod_1.z.number().int().min(8).max(256).default(28),
    frameHeight: zod_1.z.number().int().min(8).max(256).default(36),
    createdAt: zod_1.z.string().datetime(),
});
/** Server-side upload validation (mirrored client-side for UX). */
exports.ASSET_UPLOAD_LIMITS = {
    maxBytes: 5 * 1024 * 1024, // 5 MB
    allowedMime: ['image/png'],
    allowedExt: ['.png'],
};
// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
exports.ADMIN_ROLES = ['admin', 'viewer'];
exports.AdminSetupSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(32).regex(/^[a-z0-9_-]+$/i),
    password: zod_1.z.string().min(12).max(200),
    setupToken: zod_1.z.string().min(1).max(200),
});
exports.AdminLoginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1).max(32),
    password: zod_1.z.string().min(1).max(200),
});
exports.AdminUserSchema = zod_1.z.object({
    id: zod_1.z.string(),
    username: zod_1.z.string(),
    role: zod_1.z.enum(exports.ADMIN_ROLES),
    createdAt: zod_1.z.string().datetime(),
    lastLoginAt: zod_1.z.string().datetime().nullable(),
});
// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------
exports.AuditEntrySchema = zod_1.z.object({
    id: zod_1.z.string(),
    at: zod_1.z.string().datetime(),
    actor: zod_1.z.string().max(64),
    action: zod_1.z.string().max(64),
    entity: zod_1.z.string().max(32),
    entityId: zod_1.z.string().max(64),
    detail: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).default({}),
    ip: zod_1.z.string().max(64).nullable().default(null),
});
// ---------------------------------------------------------------------------
// API surface (paths + client helpers)
// ---------------------------------------------------------------------------
exports.ADMIN_API = {
    setup: '/api/admin/auth/setup',
    login: '/api/admin/auth/login',
    logout: '/api/admin/auth/logout',
    me: '/api/admin/auth/me',
    workers: '/api/admin/workers',
    worker: (id) => `/api/admin/workers/${encodeURIComponent(id)}`,
    services: '/api/admin/services',
    service: (id) => `/api/admin/services/${encodeURIComponent(id)}`,
    orders: '/api/admin/orders',
    order: (id) => `/api/admin/orders/${encodeURIComponent(id)}`,
    orderTransition: (id) => `/api/admin/orders/${encodeURIComponent(id)}/transition`,
    orderPayment: (id) => `/api/admin/orders/${encodeURIComponent(id)}/payment`,
    config: '/api/admin/config',
    configKey: (key) => `/api/admin/config/${encodeURIComponent(key)}`,
    assets: '/api/admin/assets',
    asset: (id) => `/api/admin/assets/${encodeURIComponent(id)}`,
    audit: '/api/admin/audit',
};
exports.PUBLIC_API = {
    config: '/api/public/config',
    workers: '/api/public/workers',
    services: '/api/public/services',
};
/** Live-update message types broadcast by the Worker on admin changes. */
exports.ADMIN_BROADCAST_TYPES = ['config.update', 'workers.update', 'services.update'];
//# sourceMappingURL=admin.js.map