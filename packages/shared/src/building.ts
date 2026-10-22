/**
 * Building + recovery domain contracts for the Virtual AI Office.
 *
 * Zod schemas + types for rooms, the recovery workflow (error events,
 * recovery beds, recovery config), shared between the web dashboard and
 * the Cloudflare Worker. The worker's `migrations/0002_building.sql`
 * persists the error events; the `office.recovery` office-config key is
 * registered in `admin.ts` (OFFICE_CONFIG_SCHEMAS) using the schema below.
 *
 * NOTE: the building room schema is named `BuildingRoomConfigSchema` on
 * purpose — `admin.ts` already exports an office-config `RoomConfigSchema`
 * (id/name/visible for the admin room list), and the barrel
 * (`index.ts`) re-exports both modules, so the names must not collide.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Building rooms (mirrors apps/web/src/world/building/floorPlan.ts ROOMS)
// ---------------------------------------------------------------------------

export const BuildingRoomConfigSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  /** Floor index: 0 = ground, 1 = second. */
  floor: z.union([z.literal(0), z.literal(1)]),
  type: z.string().min(1).max(32),
  description: z.string().max(500).default(''),
});
export type BuildingRoomConfig = z.infer<typeof BuildingRoomConfigSchema>;

// ---------------------------------------------------------------------------
// Recovery configuration (persisted as the `office.recovery` config key)
// ---------------------------------------------------------------------------

export const RecoveryConfigSchema = z.object({
  /** Master switch for the whole recovery workflow. */
  enabled: z.boolean().default(true),
  /** When true, errored agents are automatically walked to a free bed. */
  autoRecover: z.boolean().default(true),
  /**
   * Maximum number of recovery beds the workflow may use. Defaults to the
   * scene's bed count; the worker treats it as an upper bound on
   * concurrently tracked recovery stays.
   */
  capacity: z.number().int().min(0).max(100).default(4),
  /** Record an audit entry / notification when an agent errors. */
  notifyOnError: z.boolean().default(true),
});
export type RecoveryConfig = z.infer<typeof RecoveryConfigSchema>;

// ---------------------------------------------------------------------------
// Error events
// ---------------------------------------------------------------------------

/** What kind of failure an error event reports. */
export const ERROR_CATEGORIES = [
  'hardware',
  'software',
  'network',
  'api',
  'task',
  'unknown',
] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

/** Error-event lifecycle states. */
export const ERROR_EVENT_STATUSES = ['open', 'acknowledged', 'resolved'] as const;
export type ErrorEventStatus = (typeof ERROR_EVENT_STATUSES)[number];

/** Allowed status transitions. Terminal states have no outgoing edges. */
export const ERROR_EVENT_TRANSITIONS: Record<ErrorEventStatus, ErrorEventStatus[]> = {
  open: ['acknowledged', 'resolved'],
  acknowledged: ['resolved'],
  resolved: [],
};

export function canTransitionErrorEvent(
  from: ErrorEventStatus,
  to: ErrorEventStatus,
): boolean {
  return ERROR_EVENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export const ErrorEventSchema = z.object({
  id: z.string().min(1).max(64),
  agentId: z.string().min(1).max(64),
  category: z.enum(ERROR_CATEGORIES).default('unknown'),
  message: z.string().max(2000).default(''),
  status: z.enum(ERROR_EVENT_STATUSES).default('open'),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable().default(null),
});
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

export const ErrorEventCreateSchema = z.object({
  agentId: z.string().min(1).max(64),
  category: z.enum(ERROR_CATEGORIES).default('unknown'),
  message: z.string().max(2000).default(''),
});
export type ErrorEventCreate = z.infer<typeof ErrorEventCreateSchema>;

/** PATCH body for an error event: only the status may change. */
export const ErrorEventUpdateSchema = z.object({
  status: z.enum(ERROR_EVENT_STATUSES),
  note: z.string().max(1000).default(''),
});
export type ErrorEventUpdate = z.infer<typeof ErrorEventUpdateSchema>;
