/**
 * Vitest coverage for `EventPostSchema`.
 *
 * Run with `npm run test --workspace @virtual-ai-office/shared`.
 */
import { describe, expect, it } from 'vitest';
import { EventPostSchema } from './schemas';

describe('EventPostSchema', () => {
  it('accepts a status event', () => {
    const result = EventPostSchema.safeParse({ type: 'status', status: 'working' });
    expect(result.success).toBe(true);
  });

  it('accepts a task event with progress', () => {
    const result = EventPostSchema.safeParse({
      type: 'task',
      task: 'Refactoring the websocket hub',
      progress: 42,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.progress).toBe(42);
    }
  });

  it('accepts an activity event', () => {
    const result = EventPostSchema.safeParse({
      type: 'event',
      kind: 'note',
      message: 'Checkpoint saved.',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a heartbeat', () => {
    const result = EventPostSchema.safeParse({ type: 'heartbeat' });
    expect(result.success).toBe(true);
  });

  it('accepts a heartbeat with an empty object body', () => {
    const result = EventPostSchema.safeParse({ type: 'heartbeat' });
    expect(result.success).toBe(true);
  });

  it('rejects a status event missing the status field', () => {
    const result = EventPostSchema.safeParse({ type: 'status' });
    expect(result.success).toBe(false);
  });

  it('rejects a task event missing the task field', () => {
    const result = EventPostSchema.safeParse({ type: 'task', progress: 10 });
    expect(result.success).toBe(false);
  });

  it('rejects an activity event missing the message field', () => {
    const result = EventPostSchema.safeParse({ type: 'event', kind: 'note' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown status value', () => {
    const result = EventPostSchema.safeParse({ type: 'status', status: 'dancing' });
    expect(result.success).toBe(false);
  });

  it('rejects progress above 100', () => {
    const result = EventPostSchema.safeParse({
      type: 'task',
      task: 'Almost done',
      progress: 101,
    });
    expect(result.success).toBe(false);
  });

  it('rejects progress below 0', () => {
    const result = EventPostSchema.safeParse({
      type: 'task',
      task: 'Just started',
      progress: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown event type', () => {
    const result = EventPostSchema.safeParse({ type: 'launch-missiles' });
    expect(result.success).toBe(false);
  });
});
