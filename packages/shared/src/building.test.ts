import { describe, expect, it } from 'vitest';
import {
  AGENT_STATUSES,
  BuildingRoomConfigSchema,
  ERROR_CATEGORIES,
  ERROR_EVENT_STATUSES,
  ErrorEventCreateSchema,
  ErrorEventSchema,
  ErrorEventUpdateSchema,
  RecoveryConfigSchema,
  canTransitionErrorEvent,
} from './index';

describe('AGENT_STATUSES', () => {
  it('includes the meeting and recovering statuses', () => {
    expect(AGENT_STATUSES).toContain('meeting');
    expect(AGENT_STATUSES).toContain('recovering');
  });

  it('has no duplicates', () => {
    expect(new Set(AGENT_STATUSES).size).toBe(AGENT_STATUSES.length);
  });
});

describe('BuildingRoomConfigSchema', () => {
  it('accepts a valid room config', () => {
    const parsed = BuildingRoomConfigSchema.safeParse({
      id: 'recoveryRoom',
      name: 'Agent Recovery Room',
      floor: 0,
      type: 'recovery',
      description: 'Quiet wellness room.',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an invalid floor', () => {
    const parsed = BuildingRoomConfigSchema.safeParse({
      id: 'r1',
      name: 'R',
      floor: 2,
      type: 'workspace',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('RecoveryConfigSchema', () => {
  it('fills in defaults', () => {
    const parsed = RecoveryConfigSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.enabled).toBe(true);
      expect(parsed.data.autoRecover).toBe(true);
      expect(parsed.data.capacity).toBe(4);
      expect(parsed.data.notifyOnError).toBe(true);
    }
  });

  it('rejects a negative capacity', () => {
    expect(RecoveryConfigSchema.safeParse({ capacity: -1 }).success).toBe(false);
  });
});

describe('ErrorEventSchema', () => {
  const valid = {
    id: 'err_abc123',
    agentId: 'monitoring',
    category: 'network',
    message: 'p99 latency exceeded 800ms',
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  it('accepts a valid error event', () => {
    expect(ErrorEventSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(
      ErrorEventSchema.safeParse({ ...valid, status: 'fixed' }).success,
    ).toBe(false);
  });

  it('rejects an unknown category', () => {
    expect(
      ErrorEventCreateSchema.safeParse({ agentId: 'a', category: 'ghost' }).success,
    ).toBe(false);
  });

  it('accepts every documented category and status', () => {
    for (const category of ERROR_CATEGORIES) {
      expect(
        ErrorEventCreateSchema.safeParse({ agentId: 'a', category }).success,
      ).toBe(true);
    }
    for (const status of ERROR_EVENT_STATUSES) {
      expect(
        ErrorEventUpdateSchema.safeParse({ status }).success,
      ).toBe(true);
    }
  });
});

describe('canTransitionErrorEvent', () => {
  it('allows open -> acknowledged -> resolved', () => {
    expect(canTransitionErrorEvent('open', 'acknowledged')).toBe(true);
    expect(canTransitionErrorEvent('acknowledged', 'resolved')).toBe(true);
  });

  it('allows direct open -> resolved', () => {
    expect(canTransitionErrorEvent('open', 'resolved')).toBe(true);
  });

  it('blocks backwards and self transitions', () => {
    expect(canTransitionErrorEvent('acknowledged', 'open')).toBe(false);
    expect(canTransitionErrorEvent('resolved', 'open')).toBe(false);
    expect(canTransitionErrorEvent('resolved', 'acknowledged')).toBe(false);
    expect(canTransitionErrorEvent('open', 'open')).toBe(false);
  });
});
