import { describe, expect, it } from 'vitest';
import {
  canTransitionOrder,
  OrderTransitionSchema,
  ServiceCreateSchema,
  WorkerCreateSchema,
  WorkerUpdateSchema,
  OFFICE_CONFIG_SCHEMAS,
  AdminSetupSchema,
  OrderPaymentSchema,
} from './admin';

const now = () => new Date().toISOString();

describe('admin contracts', () => {
  it('accepts a minimal worker create payload', () => {
    const r = WorkerCreateSchema.safeParse({ id: 'w1', displayName: 'Nika' });
    expect(r.success).toBe(true);
  });

  it('rejects worker ids that are not URL-safe', () => {
    expect(WorkerCreateSchema.safeParse({ id: 'bad id!', displayName: 'x' }).success).toBe(false);
  });

  it('worker update schema cannot change id or agentSource', () => {
    const r = WorkerUpdateSchema.safeParse({ id: 'other', agentSource: 'zzz', displayName: 'New' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect('id' in r.data).toBe(false);
      expect('agentSource' in r.data).toBe(false);
      expect(r.data.displayName).toBe('New');
    }
  });

  it('enforces the order state machine', () => {
    expect(canTransitionOrder('pending', 'accepted')).toBe(true);
    expect(canTransitionOrder('pending', 'completed')).toBe(false);
    expect(canTransitionOrder('completed', 'queued')).toBe(false);
    expect(canTransitionOrder('failed', 'queued')).toBe(true);
    expect(canTransitionOrder('in_progress', 'review')).toBe(true);
    expect(OrderTransitionSchema.safeParse({ to: 'bogus' }).success).toBe(false);
  });

  it('validates office config values per key', () => {
    const branding = OFFICE_CONFIG_SCHEMAS['office.branding'];
    expect(branding.safeParse({ officeName: 'X' }).success).toBe(true);
    expect(branding.safeParse({ officeName: '', primaryColor: 'red' }).success).toBe(false);
    expect(OFFICE_CONFIG_SCHEMAS['office.theme'].safeParse('midnight').success).toBe(true);
    expect(OFFICE_CONFIG_SCHEMAS['office.theme'].safeParse('neon').success).toBe(false);
  });

  it('requires a 12+ char password and setup token for admin setup', () => {
    expect(
      AdminSetupSchema.safeParse({ username: 'root', password: 'short', setupToken: 't' }).success,
    ).toBe(false);
    expect(
      AdminSetupSchema.safeParse({ username: 'root', password: 'long-enough-123', setupToken: 't' })
        .success,
    ).toBe(true);
  });

  it('payment marking requires provider + providerRef', () => {
    expect(OrderPaymentSchema.safeParse({ provider: 'stripe' }).success).toBe(false);
    expect(
      OrderPaymentSchema.safeParse({ provider: 'stripe', providerRef: 'pi_123' }).success,
    ).toBe(true);
  });

  it('service create validates portfolio urls', () => {
    const r = ServiceCreateSchema.safeParse({
      id: 's1',
      title: 'T',
      portfolio: [{ title: 'P', url: 'not-a-url' }],
    });
    expect(r.success).toBe(false);
  });

  it('now() helper produces datetimes (sanity)', () => {
    expect(now().length).toBeGreaterThan(10);
  });
});
