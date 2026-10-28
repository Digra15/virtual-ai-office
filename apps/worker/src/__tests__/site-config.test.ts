import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_CONFIG } from '@virtual-ai-office/shared';
import { AgentRegistry } from '../registry';

describe('runtime site settings', () => {
  it('defaults to the 10-minute timeout with no announcement', () => {
    const registry = new AgentRegistry();
    const cfg = registry.getSiteConfig();
    expect(cfg.officeName).toBe('Virtual AI Office');
    expect(cfg.announcement).toBe('');
    expect(cfg.offlineTimeoutMs).toBe(600_000);
    expect(cfg.receptionistApiUrl).toBe('');
    expect(cfg.receptionistApiFormat).toBe('openai');
    expect(cfg.receptionistModel).toBe('');
  });

  it('set/get round-trips and copies (no aliasing)', () => {
    const registry = new AgentRegistry();
    const saved = registry.setSiteConfig({
      ...DEFAULT_SITE_CONFIG,
      officeName: 'Acme',
      announcement: 'Rapat 10:00',
      offlineTimeoutMs: 300_000,
    });
    expect(saved.officeName).toBe('Acme');
    saved.officeName = 'Mutated';
    expect(registry.getSiteConfig().officeName).toBe('Acme');
  });

  it('receptionist endpoint fields round-trip through set/get and snapshot', () => {
    const registry = new AgentRegistry();
    registry.setSiteConfig({
      ...DEFAULT_SITE_CONFIG,
      officeName: 'X',
      announcement: '',
      offlineTimeoutMs: 120_000,
      receptionistApiUrl: 'https://admin.example.com/v1/chat',
      receptionistApiFormat: 'openai',
      receptionistModel: 'admin-model',
    });
    const snap = registry.snapshot();
    const restored = new AgentRegistry();
    restored.restore(snap);
    const cfg = restored.getSiteConfig();
    expect(cfg.receptionistApiUrl).toBe('https://admin.example.com/v1/chat');
    expect(cfg.receptionistApiFormat).toBe('openai');
    expect(cfg.receptionistModel).toBe('admin-model');
    expect('receptionistApiKey' in cfg).toBe(false);
  });

  it('snapshot/restore keeps the config; a missing config restores defaults', () => {
    const registry = new AgentRegistry();
    registry.setSiteConfig({
      ...DEFAULT_SITE_CONFIG,
      officeName: 'Acme',
      announcement: '',
      offlineTimeoutMs: 120_000,
    });
    const snap = registry.snapshot();
    expect(snap.siteConfig?.officeName).toBe('Acme');

    const restored = new AgentRegistry();
    restored.restore(snap);
    expect(restored.getSiteConfig().officeName).toBe('Acme');

    const legacy = new AgentRegistry();
    const { siteConfig: _dropped, ...legacySnap } = snap;
    legacy.restore(legacySnap);
    expect(legacy.getSiteConfig().officeName).toBe('Virtual AI Office');
    expect(legacy.getSiteConfig().offlineTimeoutMs).toBe(600_000);
  });

  it('ensureSiteConfig seeds from env only when nothing was stored', () => {
    const fresh = new AgentRegistry();
    expect(fresh.ensureSiteConfig(30_000)).toBe(true);
    expect(fresh.getSiteConfig().offlineTimeoutMs).toBe(30_000);
    expect(fresh.ensureSiteConfig(60_000)).toBe(false);
    expect(fresh.getSiteConfig().offlineTimeoutMs).toBe(30_000);

    const saved = new AgentRegistry();
    saved.setSiteConfig({ ...DEFAULT_SITE_CONFIG, officeName: 'X', announcement: '', offlineTimeoutMs: 120_000 });
    expect(saved.ensureSiteConfig(30_000)).toBe(false);
    expect(saved.getSiteConfig().offlineTimeoutMs).toBe(120_000);
  });

  it('receptionist API key: set/clear/hasKey, never in the public config', () => {
    const registry = new AgentRegistry();
    expect(registry.hasReceptionistApiKey()).toBe(false);
    expect(registry.setReceptionistApiKey('sk-test-key')).toBe(true);
    expect(registry.hasReceptionistApiKey()).toBe(true);
    // The public GET /api/config payload structurally cannot contain it.
    const config = registry.getSiteConfig();
    expect('receptionistApiKey' in config).toBe(false);
    expect(JSON.stringify(config)).not.toContain('sk-test-key');
    expect(registry.setReceptionistApiKey('')).toBe(false);
    expect(registry.hasReceptionistApiKey()).toBe(false);
  });

  it('receptionist API key survives snapshot/restore; old snapshots default to empty', () => {
    const registry = new AgentRegistry();
    registry.setReceptionistApiKey('sk-persisted');
    const restored = new AgentRegistry();
    restored.restore(registry.snapshot());
    expect(restored.hasReceptionistApiKey()).toBe(true);
    expect(restored.getReceptionistApiKey()).toBe('sk-persisted');

    const legacy = new AgentRegistry();
    const snapshot = registry.snapshot();
    delete (snapshot as { receptionistApiKey?: string }).receptionistApiKey;
    legacy.restore(snapshot);
    expect(legacy.hasReceptionistApiKey()).toBe(false);
    expect(legacy.getReceptionistApiKey()).toBe('');
  });

  it('the offline sweep uses the stored timeout, not a fixed value', () => {
    const registry = new AgentRegistry();
    registry.seedLiveAgents();
    registry.setSiteConfig({ ...DEFAULT_SITE_CONFIG, officeName: 'X', announcement: '', offlineTimeoutMs: 600_000 });
    // Silence for 120s: under the stored 10-minute timeout nobody flips.
    const agents = registry.list();
    for (const a of agents) {
      a.lastSeen = new Date(Date.now() - 120_000).toISOString();
    }
    expect(registry.markOfflineSweep(registry.getSiteConfig().offlineTimeoutMs)).toHaveLength(0);

    registry.setSiteConfig({ ...DEFAULT_SITE_CONFIG, officeName: 'X', announcement: '', offlineTimeoutMs: 30_000 });
    expect(registry.markOfflineSweep(registry.getSiteConfig().offlineTimeoutMs)).toHaveLength(4);
  });
});
