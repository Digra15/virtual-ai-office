import { describe, expect, it, vi } from 'vitest';
import {
  RECEPTIONIST_SYSTEM_PROMPT,
  getReceptionistConfig,
  getReceptionistConfigWithStored,
  requestReceptionistReply,
  type FetchImpl,
  type ReceptionistConfig,
} from '../receptionist';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@virtual-ai-office/shared';

function okPayload(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  };
}

describe('receptionist adapter (OpenAI-compatible v1)', () => {
  it('sends system persona + history + new message, returns trimmed content', async () => {
    const fetchImpl = vi.fn(async () => okPayload('  Halo, ada yang bisa dibantu?  ')) as unknown as FetchImpl;
    const config: ReceptionistConfig = {
      url: 'https://example.com/v1/chat/completions',
      apiKey: 'key-123',
      model: 'some-model',
      format: 'openai',
    };
    const text = await requestReceptionistReply(
      config,
      [
        { role: 'user', text: 'Hai' },
        { role: 'assistant', text: 'Halo!' },
      ],
      'Kantor ini buka jam berapa?',
      fetchImpl,
    );
    expect(text).toBe('Halo, ada yang bisa dibantu?');
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('https://example.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers['Authorization']).toBe('Bearer key-123');
    expect(init.headers['content-type']).toBe('application/json');
    const body = JSON.parse(init.body) as {
      model?: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe('some-model');
    expect(body.messages[0]).toEqual({ role: 'system', content: RECEPTIONIST_SYSTEM_PROMPT });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Hai' });
    expect(body.messages[2]).toEqual({ role: 'assistant', content: 'Halo!' });
    expect(body.messages[3]).toEqual({ role: 'user', content: 'Kantor ini buka jam berapa?' });
  });

  it('omits model and Authorization when unset', async () => {
    const fetchImpl = vi.fn(async () => okPayload('Ok')) as unknown as FetchImpl;
    const text = await requestReceptionistReply(
      { url: 'https://example.com/v1/chat', apiKey: undefined, model: undefined, format: 'openai' },
      [],
      'Hai',
      fetchImpl,
    );
    expect(text).toBe('Ok');
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(init.headers['Authorization']).toBeUndefined();
    expect(JSON.parse(init.body) as { model?: string }).not.toHaveProperty('model');
  });

  it('makes no call when the URL is unset (inert)', async () => {
    const fetchImpl = vi.fn(async () => okPayload('x')) as unknown as FetchImpl;
    const text = await requestReceptionistReply(
      { url: undefined, apiKey: undefined, model: undefined, format: 'openai' },
      [],
      'Hai',
      fetchImpl,
    );
    expect(text).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('makes no call for an unsupported format', async () => {
    const fetchImpl = vi.fn(async () => okPayload('x')) as unknown as FetchImpl;
    const text = await requestReceptionistReply(
      { url: 'https://example.com/v1/chat', apiKey: undefined, model: undefined, format: 'custom' },
      [],
      'Hai',
      fetchImpl,
    );
    expect(text).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns null on non-2xx, malformed payload, and empty content', async () => {
    const cases: Array<{ fetchImpl: FetchImpl; label: string }> = [
      {
        label: 'non-2xx',
        fetchImpl: (async () => ({ ok: false, status: 500, json: async () => ({}) })) as FetchImpl,
      },
      {
        label: 'malformed',
        fetchImpl: (async () => ({
          ok: true,
          status: 200,
          json: async () => ({ nope: true }),
        })) as FetchImpl,
      },
      {
        label: 'empty',
        fetchImpl: (async () => okPayload('   ')) as FetchImpl,
      },
    ];
    for (const c of cases) {
      const text = await requestReceptionistReply(
        { url: 'https://example.com/v1/chat', apiKey: undefined, model: undefined, format: 'openai' },
        [],
        'Hai',
        c.fetchImpl,
      );
      expect(text, c.label).toBeNull();
    }
  });

  it('returns null when fetch throws, and respects the timeout', async () => {
    const throwing = (async () => {
      throw new Error('boom');
    }) as FetchImpl;
    await expect(
      requestReceptionistReply(
        { url: 'https://example.com/v1/chat', apiKey: undefined, model: undefined, format: 'openai' },
        [],
        'Hai',
        throwing,
      ),
    ).resolves.toBeNull();

    const hanging = (() => new Promise(() => {})) as unknown as FetchImpl;
    await expect(
      requestReceptionistReply(
        { url: 'https://example.com/v1/chat', apiKey: undefined, model: undefined, format: 'openai' },
        [],
        'Hai',
        hanging,
        10,
      ),
    ).resolves.toBeNull();
  });

  it('reads config from env with openai default and blank URL as unset', () => {
    const cfg = getReceptionistConfig({
      RECEPTIONIST_API_URL: '  ',
      RECEPTIONIST_API_KEY: 'k',
    } as never);
    expect(cfg.url).toBeUndefined();
    expect(cfg.format).toBe('openai');
    const cfg2 = getReceptionistConfig({
      RECEPTIONIST_API_URL: 'https://example.com/v1/chat',
      RECEPTIONIST_API_FORMAT: 'openai',
      RECEPTIONIST_MODEL: 'm1',
    } as never);
    expect(cfg2.url).toBe('https://example.com/v1/chat');
    expect(cfg2.model).toBe('m1');
  });
});

describe('receptionist config resolution (admin panel wins, env fallback)', () => {
  const env = {
    RECEPTIONIST_API_URL: 'https://env.example.com/v1',
    RECEPTIONIST_API_KEY: 'env-key',
    RECEPTIONIST_API_FORMAT: 'openai',
    RECEPTIONIST_MODEL: 'env-model',
  } as never;

  function stored(overrides: Partial<SiteConfig>): SiteConfig {
    return { ...DEFAULT_SITE_CONFIG, ...overrides };
  }

  it('stored URL beats env URL, with stored format/model', () => {
    const cfg = getReceptionistConfigWithStored(
      env,
      stored({
        receptionistApiUrl: 'https://admin.example.com/v1/chat',
        receptionistApiFormat: 'openai',
        receptionistModel: 'admin-model',
      }),
    );
    expect(cfg.url).toBe('https://admin.example.com/v1/chat');
    expect(cfg.format).toBe('openai');
    expect(cfg.model).toBe('admin-model');
    expect(cfg.apiKey).toBe('env-key');
  });

  it('empty stored URL falls back to env entirely', () => {
    const cfg = getReceptionistConfigWithStored(env, stored({ receptionistApiUrl: '' }));
    expect(cfg.url).toBe('https://env.example.com/v1');
    expect(cfg.format).toBe('openai');
    expect(cfg.model).toBe('env-model');
    expect(cfg.apiKey).toBe('env-key');
  });

  it('missing stored config falls back to env; key always comes from env only', () => {
    const cfg = getReceptionistConfigWithStored(env, undefined);
    expect(cfg.url).toBe('https://env.example.com/v1');
    expect(cfg.apiKey).toBe('env-key');
    const noKey = getReceptionistConfigWithStored(
      { RECEPTIONIST_API_URL: 'https://env.example.com/v1' } as never,
      stored({ receptionistApiUrl: 'https://admin.example.com/v1/chat' }),
    );
    expect(noKey.url).toBe('https://admin.example.com/v1/chat');
    expect(noKey.apiKey).toBeUndefined();
  });

  it('stored URL with blank model sends no model (does not inherit env model)', () => {
    const cfg = getReceptionistConfigWithStored(
      env,
      stored({ receptionistApiUrl: 'https://admin.example.com/v1/chat', receptionistModel: '' }),
    );
    expect(cfg.url).toBe('https://admin.example.com/v1/chat');
    expect(cfg.model).toBeUndefined();
  });
});
