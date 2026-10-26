/**
 * Vitest coverage for `EventPostSchema`.
 *
 * Run with `npm run test --workspace @virtual-ai-office/shared`.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_CONFIG, EventPostSchema, SiteConfigSchema, TaskPostSchema } from './schemas';

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

describe('TaskPostSchema', () => {
  it('accepts a title with optional detail', () => {
    const result = TaskPostSchema.safeParse({ title: 'Write chapter 26', detail: 'Laras confronts Raka' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty title', () => {
    expect(TaskPostSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('rejects a missing title', () => {
    expect(TaskPostSchema.safeParse({ detail: 'no title' }).success).toBe(false);
  });
});

describe('SiteConfigSchema', () => {
  it('accepts a full valid config', () => {
    const result = SiteConfigSchema.safeParse({
      officeName: 'Acme Office',
      announcement: 'Rapat 10:00',
      offlineTimeoutMs: 600_000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty office name and an overlong announcement', () => {
    expect(
      SiteConfigSchema.safeParse({ officeName: '', announcement: '', offlineTimeoutMs: 600_000 }).success,
    ).toBe(false);
    expect(
      SiteConfigSchema.safeParse({ officeName: 'X', announcement: 'a'.repeat(501), offlineTimeoutMs: 600_000 }).success,
    ).toBe(false);
  });

  it('rejects timeouts outside 30s..60min', () => {
    const base = { officeName: 'X', announcement: '' };
    expect(SiteConfigSchema.safeParse({ ...base, offlineTimeoutMs: 29_999 }).success).toBe(false);
    expect(SiteConfigSchema.safeParse({ ...base, offlineTimeoutMs: 3_600_001 }).success).toBe(false);
    expect(SiteConfigSchema.safeParse({ ...base, offlineTimeoutMs: 30_000 }).success).toBe(true);
  });

  it('defaults match the deployed 10-minute timeout', () => {
    expect(DEFAULT_SITE_CONFIG.officeName).toBe('Virtual AI Office');
    expect(DEFAULT_SITE_CONFIG.announcement).toBe('');
    expect(DEFAULT_SITE_CONFIG.offlineTimeoutMs).toBe(600_000);
  });

  it('accepts receptionist endpoint fields and fills defaults when omitted', () => {
    const base = { officeName: 'X', announcement: '', offlineTimeoutMs: 600_000 };
    const full = SiteConfigSchema.safeParse({
      ...base,
      receptionistApiUrl: 'https://example.com/v1/chat/completions',
      receptionistApiFormat: 'openai',
      receptionistModel: 'some-model',
    });
    expect(full.success).toBe(true);
    if (full.success) {
      expect(full.data.receptionistApiUrl).toBe('https://example.com/v1/chat/completions');
      expect(full.data.receptionistModel).toBe('some-model');
    }
    const omitted = SiteConfigSchema.safeParse(base);
    expect(omitted.success).toBe(true);
    if (omitted.success) {
      expect(omitted.data.receptionistApiUrl).toBe('');
      expect(omitted.data.receptionistApiFormat).toBe('openai');
      expect(omitted.data.receptionistModel).toBe('');
    }
    expect(DEFAULT_SITE_CONFIG.receptionistApiUrl).toBe('');
    expect(DEFAULT_SITE_CONFIG.receptionistApiFormat).toBe('openai');
    expect(DEFAULT_SITE_CONFIG.receptionistModel).toBe('');
  });

  it('rejects non-http(s) or overlong receptionist URLs and overlong format/model', () => {
    const base = { officeName: 'X', announcement: '', offlineTimeoutMs: 600_000 };
    expect(SiteConfigSchema.safeParse({ ...base, receptionistApiUrl: 'ftp://x.com' }).success).toBe(false);
    expect(SiteConfigSchema.safeParse({ ...base, receptionistApiUrl: 'not-a-url' }).success).toBe(false);
    expect(
      SiteConfigSchema.safeParse({ ...base, receptionistApiUrl: `https://x.com/${'a'.repeat(500)}` }).success,
    ).toBe(false);
    expect(SiteConfigSchema.safeParse({ ...base, receptionistApiFormat: 'a'.repeat(51) }).success).toBe(false);
    expect(SiteConfigSchema.safeParse({ ...base, receptionistModel: 'a'.repeat(101) }).success).toBe(false);
  });

  it('never carries a credential: unknown key fields are stripped', () => {
    const parsed = SiteConfigSchema.safeParse({
      officeName: 'X',
      announcement: '',
      offlineTimeoutMs: 600_000,
      receptionistApiKey: 'sk-should-never-be-here',
      receptionistApiUrl: 'https://example.com/v1',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect('receptionistApiKey' in parsed.data).toBe(false);
      expect(JSON.stringify(parsed.data)).not.toContain('sk-should-never-be-here');
    }
  });
});
