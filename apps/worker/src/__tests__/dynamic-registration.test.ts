/**
 * Dynamic agent registration: any authenticated report auto-creates a
 * live seat — no hardcoded closed roster. Covers identity defaults and
 * updates, no duplication, demo never promoted to live, roster inclusion,
 * auth fail-closed, and offline sweep for auto-registered seats.
 */
import { describe, expect, it } from 'vitest';
import { agentAuthError } from '../agentAuth';
import { buildWorkerRosterSection } from '../receptionist';
import { AgentRegistry, normalizeAgentId } from '../registry';

describe('dynamic registration', () => {
  it('(a) a first report for a new id creates a live seat with the sent identity', () => {
    const registry = new AgentRegistry();
    const { agent } = registry.upsertFromEvent('tara', {
      type: 'heartbeat',
      name: 'Tara',
      role: 'Designer',
      workstationId: 'ws-03',
    });
    expect(agent.id).toBe('tara');
    expect(agent.name).toBe('Tara');
    expect(agent.role).toBe('Designer');
    expect(agent.workstationId).toBe('ws-03');
    expect(agent.source).toBe('live');
    expect(registry.list()).toHaveLength(1);
  });

  it('(a) defaults apply when the report declares no identity', () => {
    const registry = new AgentRegistry();
    const { agent } = registry.upsertFromEvent('ext-9', { type: 'heartbeat' });
    expect(agent.name).toBe('ext-9');
    expect(agent.role).toBe('External Agent');
    expect(agent.workstationId).toBe('ws-remote');
    expect(agent.source).toBe('live');
  });

  it('(b) a second report updates status/task/identity without duplicating the seat', () => {
    const registry = new AgentRegistry();
    registry.upsertFromEvent('tara', { type: 'heartbeat', name: 'Tara', role: 'Designer' });
    const { agent } = registry.upsertFromEvent('tara', {
      type: 'task',
      task: 'Mendesain poster',
      progress: 40,
      name: 'Tara Wijaya',
      role: 'Senior Designer',
      workstationId: 'ws-04',
    });
    expect(registry.list()).toHaveLength(1);
    expect(agent.status).toBe('working');
    expect(agent.currentTask).toBe('Mendesain poster');
    expect(agent.progress).toBe(40);
    expect(agent.name).toBe('Tara Wijaya');
    expect(agent.role).toBe('Senior Designer');
    expect(agent.workstationId).toBe('ws-04');
    expect(agent.source).toBe('live');
  });

  it('(b) blank identity fields on later reports leave identity untouched', () => {
    const registry = new AgentRegistry();
    registry.upsertFromEvent('tara', { type: 'heartbeat', name: 'Tara', role: 'Designer' });
    const { agent } = registry.upsertFromEvent('tara', { type: 'status', status: 'working' });
    expect(agent.name).toBe('Tara');
    expect(agent.role).toBe('Designer');
  });

  it('(c) a demo agent reporting never becomes live, and purge keeps live seats', () => {
    const registry = new AgentRegistry();
    registry.seedDemoAgents();
    const { agent } = registry.upsertFromEvent('nika', { type: 'status', status: 'working' });
    expect(agent.source).toBe('demo');
    registry.upsertFromEvent('tara', { type: 'heartbeat', name: 'Tara' });
    expect(registry.purgeDemoAgents()).toBe(8);
    expect(registry.get('nika')).toBeUndefined();
    const tara = registry.get('tara');
    expect(tara?.source).toBe('live');
    expect(tara?.name).toBe('Tara');
  });

  it('(c) demo seeding never overwrites an existing live seat', () => {
    const registry = new AgentRegistry();
    registry.upsertFromEvent('nika', { type: 'heartbeat', name: 'Nika Live' });
    registry.seedDemoAgents();
    expect(registry.get('nika')?.name).toBe('Nika Live');
    expect(registry.get('nika')?.source).toBe('live');
  });

  it('(d) the receptionist roster includes auto-registered live seats, never demo', () => {
    const registry = new AgentRegistry();
    registry.seedLiveAgents();
    registry.seedDemoAgents();
    registry.upsertFromEvent('tara', { type: 'heartbeat', name: 'Tara', role: 'Designer' });
    const section = buildWorkerRosterSection(
      registry.list().filter((a) => a.source === 'live'),
    );
    expect(section).toContain('- Tara (Designer) — idle');
    expect(section).toContain('- Difia (Receptionist, perempuan)');
    expect(section).not.toContain('Nika');
  });

  it('(e) agent auth fails closed without a secret and rejects wrong tokens', () => {
    expect(agentAuthError(undefined, 'Bearer anything')).toBe(503);
    expect(agentAuthError('', 'Bearer anything')).toBe(503);
    expect(agentAuthError('s3cret', null)).toBe(403);
    expect(agentAuthError('s3cret', 's3cret')).toBe(403);
    expect(agentAuthError('s3cret', 'Bearer wrong')).toBe(403);
    expect(agentAuthError('s3cret', 'Bearer s3cret')).toBeNull();
  });

  it('(f) offline sweep marks a stale auto-registered seat offline', () => {
    const registry = new AgentRegistry();
    registry.upsertFromEvent('tara', { type: 'heartbeat', name: 'Tara' });
    const stored = registry.get('tara');
    expect(stored).toBeDefined();
    if (!stored) return;
    stored.lastSeen = new Date(Date.now() - 3600_000).toISOString();
    const changed = registry.markOfflineSweep(600_000);
    expect(changed.map((a) => a.id)).toContain('tara');
    expect(registry.get('tara')?.status).toBe('offline');
  });

  it('snapshot/restore preserves auto-registered live seats', () => {
    const registry = new AgentRegistry();
    registry.seedLiveAgents();
    registry.upsertFromEvent('tara', { type: 'heartbeat', name: 'Tara', role: 'Designer' });
    const restored = new AgentRegistry();
    restored.restore(registry.snapshot());
    const tara = restored.get('tara');
    expect(tara?.name).toBe('Tara');
    expect(tara?.role).toBe('Designer');
    expect(tara?.source).toBe('live');
    expect(restored.list()).toHaveLength(4);
  });

  it('normalizeAgentId trims and lowercases', () => {
    expect(normalizeAgentId('  Tara ')).toBe('tara');
    expect(normalizeAgentId('DIFIA')).toBe('difia');
    expect(normalizeAgentId('   ')).toBe('');
  });
});

describe('agent gender', () => {
  it('founder seeds carry their gender', () => {
    const registry = new AgentRegistry();
    registry.seedLiveAgents();
    expect(registry.get('difia')?.gender).toBe('female');
    expect(registry.get('kirana')?.gender).toBe('female');
    expect(registry.get('reno')?.gender).toBe('male');
  });

  it('a first report can declare gender; a report without gender leaves it unknown', () => {
    const registry = new AgentRegistry();
    const { agent } = registry.upsertFromEvent('tara', {
      type: 'heartbeat',
      name: 'Tara',
      role: 'Designer',
      gender: 'female',
    });
    expect(agent.gender).toBe('female');
    const { agent: noGender } = registry.upsertFromEvent('ext-9', { type: 'heartbeat' });
    expect(noGender.gender).toBeUndefined();
  });

  it('a later report updates gender; a report without gender keeps the stored one', () => {
    const registry = new AgentRegistry();
    registry.upsertFromEvent('tara', { type: 'heartbeat', name: 'Tara', role: 'Designer', gender: 'female' });
    const { agent } = registry.upsertFromEvent('tara', { type: 'heartbeat', gender: 'male' });
    expect(agent.gender).toBe('male');
    const again = registry.upsertFromEvent('tara', { type: 'heartbeat' }).agent;
    expect(again.gender).toBe('male');
  });

  it('seed backfills gender for a pre-gender founder seat but never overwrites a reported one', () => {
    // Simulate a snapshot from before gender existed: strip the gender
    // field from a founder seat, restore it, and seed — the seed gender
    // must fill the gap.
    const legacy = new AgentRegistry();
    legacy.upsertFromEvent('difia', { type: 'heartbeat' });
    const snap = legacy.snapshot();
    for (const a of snap.agents) {
      delete a.gender;
    }
    const registry = new AgentRegistry();
    registry.restore(snap);
    expect(registry.get('difia')?.gender).toBeUndefined();
    registry.seedLiveAgents();
    expect(registry.get('difia')?.gender).toBe('female');
    // A reported gender wins over the seed on later seed calls.
    registry.upsertFromEvent('reno', { type: 'heartbeat', gender: 'female' });
    registry.seedLiveAgents();
    expect(registry.get('reno')?.gender).toBe('female');
  });

  it('snapshot/restore preserves gender', () => {
    const registry = new AgentRegistry();
    registry.seedLiveAgents();
    registry.upsertFromEvent('tara', { type: 'heartbeat', gender: 'female' });
    const restored = new AgentRegistry();
    restored.restore(registry.snapshot());
    expect(restored.get('difia')?.gender).toBe('female');
    expect(restored.get('tara')?.gender).toBe('female');
  });
});
