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
    expect(registry.markOfflineSweep(registry.getSiteConfig().offlineTimeoutMs)).toHaveLength(3);
  });
});
