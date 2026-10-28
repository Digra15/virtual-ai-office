import { describe, expect, it, vi } from 'vitest';
import {
  RECEPTIONIST_SYSTEM_PROMPT,
  buildWorkerRosterSection,
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

describe('receptionist key resolution (admin-panel key wins, env secret fallback)', () => {
  const env = {
    RECEPTIONIST_API_URL: 'https://env.example.com/v1',
    RECEPTIONIST_API_KEY: 'env-key',
    RECEPTIONIST_API_FORMAT: 'openai',
  } as never;

  function stored(overrides: Partial<SiteConfig>): SiteConfig {
    return { ...DEFAULT_SITE_CONFIG, ...overrides };
  }

  it('non-empty stored key beats the env secret, with or without a stored URL', () => {
    const withUrl = getReceptionistConfigWithStored(
      env,
      stored({ receptionistApiUrl: 'https://admin.example.com/v1/chat' }),
      'admin-key',
    );
    expect(withUrl.apiKey).toBe('admin-key');
    const withoutUrl = getReceptionistConfigWithStored(env, stored({ receptionistApiUrl: '' }), 'admin-key');
    expect(withoutUrl.apiKey).toBe('admin-key');
    expect(withoutUrl.url).toBe('https://env.example.com/v1');
  });

  it('empty or whitespace-only stored key falls back to the env secret', () => {
    expect(getReceptionistConfigWithStored(env, undefined, '').apiKey).toBe('env-key');
    expect(getReceptionistConfigWithStored(env, undefined, '   ').apiKey).toBe('env-key');
    expect(getReceptionistConfigWithStored(env, undefined, undefined).apiKey).toBe('env-key');
  });

  it('no stored key and no env secret means no Authorization header value', () => {
    const cfg = getReceptionistConfigWithStored(
      { RECEPTIONIST_API_URL: 'https://env.example.com/v1' } as never,
      undefined,
      '',
    );
    expect(cfg.apiKey).toBeUndefined();
  });
});

describe('worker roster section for the receptionist', () => {
  const agents = [
    { name: 'Nayla', role: 'Customer Service', status: 'idle', currentTask: 'Standing by at the reception desk' },
    { name: 'Difia', role: 'Project Manager', status: 'idle', currentTask: 'Standing by in the Project Room' },
    { name: 'Kirana', role: 'Writer', status: 'working', currentTask: 'Menulis artikel' },
    { name: 'Reno', role: 'Software Engineering', status: 'idle', currentTask: '' },
  ];

  it('renders one line per worker with name, role, status, and task', () => {
    const section = buildWorkerRosterSection(agents);
    expect(section).toContain('DAFTAR WORKER KANTOR');
    expect(section).toContain('- Nayla (Customer Service) — idle — Standing by at the reception desk');
    expect(section).toContain('- Difia (Project Manager) — idle — Standing by in the Project Room');
    expect(section).toContain('- Kirana (Writer) — working — Menulis artikel');
    expect(section).toContain('- Reno (Software Engineering) — idle');
  });

  it('omits the trailing task separator when the task is blank', () => {
    const section = buildWorkerRosterSection(agents);
    const renoLine = section.split('\n').find((l) => l.startsWith('- Reno'));
    expect(renoLine).toBe('- Reno (Software Engineering) — idle');
  });

  it('returns empty string when there are no workers', () => {
    expect(buildWorkerRosterSection([])).toBe('');
  });

  it('appends the roster to the system prompt when provided', async () => {
    const fetchImpl = vi.fn(async () => okPayload('Ok')) as unknown as FetchImpl;
    const config: ReceptionistConfig = {
      url: 'https://example.com/v1/chat/completions',
      apiKey: 'key-123',
      model: undefined,
      format: 'openai',
    };
    const roster = buildWorkerRosterSection(agents);
    await requestReceptionistReply(config, [], 'Siapa itu Reno?', fetchImpl, undefined, roster);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('https://example.com/v1/chat/completions');
    const body = JSON.parse(init.body) as { messages: Array<{ role: string; content: string }> };
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain(RECEPTIONIST_SYSTEM_PROMPT);
    expect(body.messages[0].content).toContain('- Reno (Software Engineering) — idle');
    expect(body.messages[0].content).toContain('- Kirana (Writer) — working — Menulis artikel');
  });

  it('sends the bare persona prompt when no roster is given', async () => {
    const fetchImpl = vi.fn(async () => okPayload('Ok')) as unknown as FetchImpl;
    const config: ReceptionistConfig = {
      url: 'https://example.com/v1/chat/completions',
      apiKey: 'key-123',
      model: undefined,
      format: 'openai',
    };
    await requestReceptionistReply(config, [], 'Halo', fetchImpl);
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    const body = JSON.parse(init.body) as { messages: Array<{ role: string; content: string }> };
    expect(body.messages[0]).toEqual({ role: 'system', content: RECEPTIONIST_SYSTEM_PROMPT });
  });
});

describe('receptionist persona rules (professional, no fake promises)', () => {
  it('forbids invented prices/deadlines and the fake "sudah dicatat" claim', () => {
    expect(RECEPTIONIST_SYSTEM_PROMPT).toContain('jangan pernah menyebut angka apa pun');
    expect(RECEPTIONIST_SYSTEM_PROMPT).toContain('jangan pernah mengarang tenggat');
    expect(RECEPTIONIST_SYSTEM_PROMPT).toContain('tidak ada sistem tiket');
    expect(RECEPTIONIST_SYSTEM_PROMPT).not.toContain('tawarkan untuk mencatat');
  });

  it('is Nayla, Customer Service, escalating to Difia the Project Manager', () => {
    expect(RECEPTIONIST_SYSTEM_PROMPT).toContain('Kamu adalah Nayla, Customer Service');
    expect(RECEPTIONIST_SYSTEM_PROMPT).toContain('Difia, Project Manager');
    expect(RECEPTIONIST_SYSTEM_PROMPT).not.toContain('Kamu adalah Difia');
  });

  it('requires a concrete next step: confirm the request, ask the missing detail, route via this thread', () => {
    expect(RECEPTIONIST_SYSTEM_PROMPT).toContain('ulangi permintaan itu dalam satu kalimat');
    expect(RECEPTIONIST_SYSTEM_PROMPT).toContain('tanyakan detail yang kurang');
    expect(RECEPTIONIST_SYSTEM_PROMPT).toContain('lewat chat ini juga');
  });
});

describe('worker roster section gender', () => {
  it('includes gender in Indonesian when known', () => {
    const section = buildWorkerRosterSection([
      { name: 'Nayla', role: 'Customer Service', status: 'idle', currentTask: '', gender: 'female' },
      { name: 'Reno', role: 'Software Engineering', status: 'idle', currentTask: '', gender: 'male' },
    ]);
    expect(section).toContain('- Nayla (Customer Service, perempuan) — idle');
    expect(section).toContain('- Reno (Software Engineering, laki-laki) — idle');
  });

  it('omits the gender fragment when gender is unknown', () => {
    const section = buildWorkerRosterSection([
      { name: 'Tara', role: 'Designer', status: 'idle', currentTask: '' },
    ]);
    expect(section).toContain('- Tara (Designer) — idle');
    expect(section).not.toContain('laki-laki');
    expect(section).not.toContain('perempuan');
  });
});
