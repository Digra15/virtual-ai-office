/**
 * Admin domain contracts for the Virtual AI Office.
 *
 * Zod schemas + types for workers, services, orders, office configuration,
 * character assets, auth, and audit logging. The Cloudflare Worker validates
 * every admin mutation against these; the /admin frontend builds its forms
 * from them. Keep in sync with `apps/worker/migrations/*.sql`.
 */
import { z } from 'zod';
/** Roles a worker can hold (display purposes; not a permission). */
export declare const WORKER_ROLES: readonly ["assistant", "research", "coding", "writing", "design", "data", "automation", "monitoring", "qa", "custom"];
export type WorkerRole = (typeof WORKER_ROLES)[number];
/** Animation profiles selectable in the admin panel. */
export declare const ANIMATION_PROFILES: readonly ["default", "calm", "energetic", "formal"];
export type AnimationProfile = (typeof ANIMATION_PROFILES)[number];
/**
 * A worker record. `id` is the stable integration identity — it NEVER
 * changes, even when `displayName` is edited. `agentSource` is the
 * underlying agent/connector identifier; renaming or deleting a worker
 * record must never terminate the underlying AI agent.
 */
export declare const WorkerSchema: z.ZodObject<{
    id: z.ZodString;
    displayName: z.ZodString;
    role: z.ZodEnum<{
        custom: "custom";
        assistant: "assistant";
        research: "research";
        coding: "coding";
        writing: "writing";
        design: "design";
        data: "data";
        automation: "automation";
        monitoring: "monitoring";
        qa: "qa";
    }>;
    description: z.ZodDefault<z.ZodString>;
    agentSource: z.ZodDefault<z.ZodString>;
    status: z.ZodDefault<z.ZodString>;
    lastSeen: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    currentTask: z.ZodDefault<z.ZodString>;
    workstationId: z.ZodDefault<z.ZodString>;
    publicVisible: z.ZodDefault<z.ZodBoolean>;
    characterModel: z.ZodDefault<z.ZodString>;
    characterConfig: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    accentColor: z.ZodDefault<z.ZodString>;
    animationProfile: z.ZodDefault<z.ZodEnum<{
        default: "default";
        calm: "calm";
        energetic: "energetic";
        formal: "formal";
    }>>;
    services: z.ZodDefault<z.ZodArray<z.ZodString>>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
    displaySettings: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    archived: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type Worker = z.infer<typeof WorkerSchema>;
export declare const WorkerCreateSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    displayName: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<{
        custom: "custom";
        assistant: "assistant";
        research: "research";
        coding: "coding";
        writing: "writing";
        design: "design";
        data: "data";
        automation: "automation";
        monitoring: "monitoring";
        qa: "qa";
    }>>;
    description: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    agentSource: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    lastSeen: z.ZodOptional<z.ZodDefault<z.ZodNullable<z.ZodString>>>;
    currentTask: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    workstationId: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    publicVisible: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    characterModel: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    characterConfig: z.ZodOptional<z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    accentColor: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    animationProfile: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        default: "default";
        calm: "calm";
        energetic: "energetic";
        formal: "formal";
    }>>>;
    services: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString>>>;
    sortOrder: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    displaySettings: z.ZodOptional<z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    archived: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, z.core.$strip>;
export type WorkerCreate = z.infer<typeof WorkerCreateSchema>;
/**
 * Updates must never change `id` or `agentSource` — renaming a worker is a
 * display-only operation. The server enforces this by stripping those keys.
 */
export declare const WorkerUpdateSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
    displayName: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
        custom: "custom";
        assistant: "assistant";
        research: "research";
        coding: "coding";
        writing: "writing";
        design: "design";
        data: "data";
        automation: "automation";
        monitoring: "monitoring";
        qa: "qa";
    }>>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
    lastSeen: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodNullable<z.ZodString>>>>;
    currentTask: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
    workstationId: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
    publicVisible: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodBoolean>>>;
    characterModel: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
    characterConfig: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
    accentColor: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
    animationProfile: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        default: "default";
        calm: "calm";
        energetic: "energetic";
        formal: "formal";
    }>>>>;
    services: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString>>>>;
    sortOrder: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodNumber>>>;
    displaySettings: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>>>;
    archived: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodBoolean>>>;
}, z.core.$strip>;
export type WorkerUpdate = z.infer<typeof WorkerUpdateSchema>;
/** Public view: only approved fields, non-public/archived workers excluded server-side. */
export declare const PublicWorkerSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodDefault<z.ZodString>;
    displayName: z.ZodString;
    role: z.ZodEnum<{
        custom: "custom";
        assistant: "assistant";
        research: "research";
        coding: "coding";
        writing: "writing";
        design: "design";
        data: "data";
        automation: "automation";
        monitoring: "monitoring";
        qa: "qa";
    }>;
    description: z.ZodDefault<z.ZodString>;
    lastSeen: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    currentTask: z.ZodDefault<z.ZodString>;
    workstationId: z.ZodDefault<z.ZodString>;
    characterModel: z.ZodDefault<z.ZodString>;
    characterConfig: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    accentColor: z.ZodDefault<z.ZodString>;
    animationProfile: z.ZodDefault<z.ZodEnum<{
        default: "default";
        calm: "calm";
        energetic: "energetic";
        formal: "formal";
    }>>;
    services: z.ZodDefault<z.ZodArray<z.ZodString>>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type PublicWorker = z.infer<typeof PublicWorkerSchema>;
export declare const SERVICE_STATUSES: readonly ["draft", "published"];
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];
export declare const PortfolioItemSchema: z.ZodObject<{
    title: z.ZodString;
    url: z.ZodString;
    imageUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PortfolioItem = z.infer<typeof PortfolioItemSchema>;
export declare const ServiceSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    workerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    price: z.ZodDefault<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
    deliveryEstimate: z.ZodDefault<z.ZodString>;
    inputRequirements: z.ZodDefault<z.ZodString>;
    revisionPolicy: z.ZodDefault<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        draft: "draft";
        published: "published";
    }>>;
    portfolio: z.ZodDefault<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        url: z.ZodString;
        imageUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    aiDisclosure: z.ZodDefault<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type Service = z.infer<typeof ServiceSchema>;
export declare const ServiceCreateSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        draft: "draft";
        published: "published";
    }>>>;
    description: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    sortOrder: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    workerId: z.ZodOptional<z.ZodDefault<z.ZodNullable<z.ZodString>>>;
    price: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    currency: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    deliveryEstimate: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    inputRequirements: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    revisionPolicy: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    portfolio: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        url: z.ZodString;
        imageUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>>;
    aiDisclosure: z.ZodOptional<z.ZodDefault<z.ZodString>>;
}, z.core.$strip>;
export type ServiceCreate = z.infer<typeof ServiceCreateSchema>;
export declare const ServiceUpdateSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        draft: "draft";
        published: "published";
    }>>>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
    sortOrder: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodNumber>>>;
    workerId: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodNullable<z.ZodString>>>>;
    price: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodNumber>>>;
    currency: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
    deliveryEstimate: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
    inputRequirements: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
    revisionPolicy: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
    portfolio: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        url: z.ZodString;
        imageUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>>>;
    aiDisclosure: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodString>>>;
}, z.core.$strip>;
export type ServiceUpdate = z.infer<typeof ServiceUpdateSchema>;
export declare const PublicServiceSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<{
        draft: "draft";
        published: "published";
    }>>;
    description: z.ZodDefault<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    workerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    price: z.ZodDefault<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodString>;
    deliveryEstimate: z.ZodDefault<z.ZodString>;
    inputRequirements: z.ZodDefault<z.ZodString>;
    revisionPolicy: z.ZodDefault<z.ZodString>;
    portfolio: z.ZodDefault<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        url: z.ZodString;
        imageUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    aiDisclosure: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type PublicService = z.infer<typeof PublicServiceSchema>;
export declare const ORDER_STATES: readonly ["pending", "accepted", "queued", "in_progress", "review", "completed", "cancelled", "failed"];
export type OrderState = (typeof ORDER_STATES)[number];
/** Allowed state transitions. Terminal states have no outgoing edges. */
export declare const ORDER_TRANSITIONS: Record<OrderState, OrderState[]>;
export declare function canTransitionOrder(from: OrderState, to: OrderState): boolean;
export declare const REVIEW_STATES: readonly ["none", "pending", "approved", "rejected"];
export type ReviewState = (typeof REVIEW_STATES)[number];
export declare const AttachmentSchema: z.ZodObject<{
    name: z.ZodString;
    url: z.ZodString;
    mime: z.ZodDefault<z.ZodString>;
    size: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type Attachment = z.infer<typeof AttachmentSchema>;
export declare const DeliverableSchema: z.ZodObject<{
    title: z.ZodString;
    url: z.ZodString;
    note: z.ZodDefault<z.ZodString>;
    at: z.ZodString;
}, z.core.$strip>;
export type Deliverable = z.infer<typeof DeliverableSchema>;
export declare const OrderSchema: z.ZodObject<{
    id: z.ZodString;
    customerName: z.ZodDefault<z.ZodString>;
    customerContact: z.ZodDefault<z.ZodString>;
    serviceId: z.ZodString;
    brief: z.ZodDefault<z.ZodString>;
    attachments: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
        mime: z.ZodDefault<z.ZodString>;
        size: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>>;
    status: z.ZodDefault<z.ZodEnum<{
        in_progress: "in_progress";
        review: "review";
        pending: "pending";
        accepted: "accepted";
        queued: "queued";
        completed: "completed";
        cancelled: "cancelled";
        failed: "failed";
    }>>;
    workerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    paid: z.ZodDefault<z.ZodBoolean>;
    paymentRef: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    deliverables: z.ZodDefault<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        url: z.ZodString;
        note: z.ZodDefault<z.ZodString>;
        at: z.ZodString;
    }, z.core.$strip>>>;
    reviewState: z.ZodDefault<z.ZodEnum<{
        pending: "pending";
        none: "none";
        approved: "approved";
        rejected: "rejected";
    }>>;
    reviewNote: z.ZodDefault<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    completedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type Order = z.infer<typeof OrderSchema>;
export declare const OrderCreateSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    customerName: z.ZodDefault<z.ZodString>;
    customerContact: z.ZodDefault<z.ZodString>;
    serviceId: z.ZodString;
    brief: z.ZodDefault<z.ZodString>;
    attachments: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
        mime: z.ZodDefault<z.ZodString>;
        size: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>>;
    workerId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type OrderCreate = z.infer<typeof OrderCreateSchema>;
export declare const OrderTransitionSchema: z.ZodObject<{
    to: z.ZodEnum<{
        in_progress: "in_progress";
        review: "review";
        pending: "pending";
        accepted: "accepted";
        queued: "queued";
        completed: "completed";
        cancelled: "cancelled";
        failed: "failed";
    }>;
    note: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type OrderTransition = z.infer<typeof OrderTransitionSchema>;
export declare const OrderPaymentSchema: z.ZodObject<{
    provider: z.ZodString;
    providerRef: z.ZodString;
}, z.core.$strip>;
export type OrderPayment = z.infer<typeof OrderPaymentSchema>;
/** Theme presets for the office chrome (2D dashboard + 3D accents). */
export declare const THEME_PRESETS: readonly ["midnight", "dawn", "forest", "mono"];
export type ThemePreset = (typeof THEME_PRESETS)[number];
export declare const RoomConfigSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    visible: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type RoomConfig = z.infer<typeof RoomConfigSchema>;
export declare const WorkstationConfigSchema: z.ZodObject<{
    id: z.ZodString;
    position: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    rotationY: z.ZodDefault<z.ZodNumber>;
    label: z.ZodDefault<z.ZodString>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type WorkstationConfig = z.infer<typeof WorkstationConfigSchema>;
export declare const BrandingConfigSchema: z.ZodObject<{
    officeName: z.ZodDefault<z.ZodString>;
    tagline: z.ZodDefault<z.ZodString>;
    logoUrl: z.ZodDefault<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
    primaryColor: z.ZodDefault<z.ZodString>;
    accentColor: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type BrandingConfig = z.infer<typeof BrandingConfigSchema>;
export declare const CameraDefaultsSchema: z.ZodObject<{
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    target: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    fov: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type CameraDefaults = z.infer<typeof CameraDefaultsSchema>;
/** Validated office-config keys and their value schemas. */
export declare const OFFICE_CONFIG_SCHEMAS: {
    readonly 'office.branding': z.ZodObject<{
        officeName: z.ZodDefault<z.ZodString>;
        tagline: z.ZodDefault<z.ZodString>;
        logoUrl: z.ZodDefault<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
        primaryColor: z.ZodDefault<z.ZodString>;
        accentColor: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>;
    readonly 'office.theme': z.ZodEnum<{
        midnight: "midnight";
        dawn: "dawn";
        forest: "forest";
        mono: "mono";
    }>;
    readonly 'office.rooms': z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        visible: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    readonly 'office.workstations': z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        position: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        rotationY: z.ZodDefault<z.ZodNumber>;
        label: z.ZodDefault<z.ZodString>;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    /** workerId -> workstationId assignments. */
    readonly 'office.assignments': z.ZodRecord<z.ZodString, z.ZodString>;
    readonly 'office.visibility': z.ZodObject<{
        publicScene: z.ZodDefault<z.ZodBoolean>;
        showOffline: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>;
    readonly 'office.camera': z.ZodObject<{
        position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
        target: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
        fov: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>;
};
export type OfficeConfigKey = keyof typeof OFFICE_CONFIG_SCHEMAS;
export declare const AssetSupportSchema: z.ZodObject<{
    hairColor: z.ZodDefault<z.ZodBoolean>;
    eyeColor: z.ZodDefault<z.ZodBoolean>;
    outfit: z.ZodDefault<z.ZodBoolean>;
    accessories: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type AssetSupport = z.infer<typeof AssetSupportSchema>;
export declare const AssetManifestEntrySchema: z.ZodObject<{
    id: z.ZodString;
    url: z.ZodString;
    kind: z.ZodDefault<z.ZodEnum<{
        png: "png";
    }>>;
    attribution: z.ZodDefault<z.ZodString>;
    license: z.ZodDefault<z.ZodString>;
    supports: z.ZodDefault<z.ZodObject<{
        hairColor: z.ZodDefault<z.ZodBoolean>;
        eyeColor: z.ZodDefault<z.ZodBoolean>;
        outfit: z.ZodDefault<z.ZodBoolean>;
        accessories: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    animations: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    frameWidth: z.ZodDefault<z.ZodNumber>;
    frameHeight: z.ZodDefault<z.ZodNumber>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type AssetManifestEntry = z.infer<typeof AssetManifestEntrySchema>;
/** Server-side upload validation (mirrored client-side for UX). */
export declare const ASSET_UPLOAD_LIMITS: {
    readonly maxBytes: number;
    readonly allowedMime: readonly ["image/png"];
    readonly allowedExt: readonly [".png"];
};
export declare const ADMIN_ROLES: readonly ["admin", "viewer"];
export type AdminRole = (typeof ADMIN_ROLES)[number];
export declare const AdminSetupSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
    setupToken: z.ZodString;
}, z.core.$strip>;
export type AdminSetup = z.infer<typeof AdminSetupSchema>;
export declare const AdminLoginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export type AdminLogin = z.infer<typeof AdminLoginSchema>;
export declare const AdminUserSchema: z.ZodObject<{
    id: z.ZodString;
    username: z.ZodString;
    role: z.ZodEnum<{
        admin: "admin";
        viewer: "viewer";
    }>;
    createdAt: z.ZodString;
    lastLoginAt: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type AdminUser = z.infer<typeof AdminUserSchema>;
export declare const AuditEntrySchema: z.ZodObject<{
    id: z.ZodString;
    at: z.ZodString;
    actor: z.ZodString;
    action: z.ZodString;
    entity: z.ZodString;
    entityId: z.ZodString;
    detail: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    ip: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
export declare const ADMIN_API: {
    readonly setup: "/api/admin/auth/setup";
    readonly login: "/api/admin/auth/login";
    readonly logout: "/api/admin/auth/logout";
    readonly me: "/api/admin/auth/me";
    readonly workers: "/api/admin/workers";
    readonly worker: (id: string) => string;
    readonly services: "/api/admin/services";
    readonly service: (id: string) => string;
    readonly orders: "/api/admin/orders";
    readonly order: (id: string) => string;
    readonly orderTransition: (id: string) => string;
    readonly orderPayment: (id: string) => string;
    readonly config: "/api/admin/config";
    readonly configKey: (key: string) => string;
    readonly assets: "/api/admin/assets";
    readonly asset: (id: string) => string;
    readonly audit: "/api/admin/audit";
};
export declare const PUBLIC_API: {
    readonly config: "/api/public/config";
    readonly workers: "/api/public/workers";
    readonly services: "/api/public/services";
};
/** Live-update message types broadcast by the Worker on admin changes. */
export declare const ADMIN_BROADCAST_TYPES: readonly ["config.update", "workers.update", "services.update"];
export type AdminBroadcastType = (typeof ADMIN_BROADCAST_TYPES)[number];
//# sourceMappingURL=admin.d.ts.map