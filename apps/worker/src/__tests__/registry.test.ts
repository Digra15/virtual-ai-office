import { describe, expect, it } from 'vitest';
import { AgentRegistry, DEMO_SEEDS } from '../registry';
import { demoTick, pick } from '../demo';
import type { EventPost } from '@virtual-ai-office/shared';

describe('AgentRegistry (worker port)', () => {
  it('seeds the 8 demo agents, idempotently', () => {
    const registry = new AgentRegistry();
    registry.seedDemoAgents();
    registry.seedDemoAgents();
    const agents = registry.list();
    expect(agents).toHaveLength(8);
    expect(agents.every((a) => a.source === 'demo')).toBe(true);
    expect(agents.map((a) => a.id).sort()).toEqual(DEMO_SEEDS.map((s) => s.id).sort());
  });

  it('creates live agents on first event, defaulting fields', () => {
    const registry = new AgentRegistry();
    const { agent, entry } = registry.upsertFromEvent('ext-1', { type: 'heartbeat' });
    expect(agent.source).toBe('live');
    expect(agent.name).toBe('ext-1');
    expect(agent.workstationId).toBe('ws-remote');
    expect(entry).toBeNull(); // heartbeat with no state change appends nothing
  });

  it('applies status/task/event mutations like the Node store', () => {
    const registry = new AgentRegistry();
    registry.seedDemoAgents();

    const s = registry.upsertFromEvent('nika', { type: 'status', status: 'working' });
    expect(s.agent.status).toBe('working');
    expect(s.entry?.kind).toBe('status');

    const t = registry.upsertFromEvent('nika', { type: 'task', task: 'New task', progress: 10 });
    expect(t.agent.currentTask).toBe('New task');
    expect(t.agent.progress).toBe(10);

    const e = registry.upsertFromEvent('nika', { type: 'event', kind: 'note', message: 'hi' });
    expect(e.entry?.kind).toBe('note');
    expect(registry.recentEvents('nika', 50)).toHaveLength(4); // system + 3
  });

  it('marks silent agents offline and revives them on heartbeat', () => {
    const registry = new AgentRegistry();
    registry.seedDemoAgents();
    const agent = registry.get('nika');
    if (!agent) throw new Error('seed missing');
    agent.lastSeen = new Date(Date.now() - 120_000).toISOString();

    const changed = registry.markOfflineSweep(30_000);
    expect(changed.map((a) => a.id)).toContain('nika');
    expect(registry.get('nika')?.status).toBe('offline');

    const revived = registry.upsertFromEvent('nika', { type: 'heartbeat' });
    expect(revived.agent.status).toBe('idle');
    expect(revived.entry?.kind).toBe('system');
  });

  it('round-trips through snapshot()/restore() for DO persistence', () => {
    const a = new AgentRegistry();
    a.seedDemoAgents();
    a.upsertFromEvent('coding', { type: 'task', task: 'x', progress: 5 });

    const b = new AgentRegistry();
    b.restore(a.snapshot());
    expect(b.list()).toHaveLength(8);
    expect(b.get('coding')?.currentTask).toBe('x');
    expect(b.recentEvents('coding', 10)?.length).toBeGreaterThan(0);
  });
});

describe('demoTick', () => {
  it('heartbeats every demo agent and emits one extra event', () => {
    const registry = new AgentRegistry();
    registry.seedDemoAgents();
    const seen: Array<[string, EventPost]> = [];
    // Deterministic rand: roll 0.9 -> extra heartbeat, then stable picks.
    demoTick(registry, (id, ev) => seen.push([id, ev]), () => 0.9);
    const heartbeats = seen.filter(([, ev]) => ev.type === 'heartbeat');
    expect(heartbeats.length).toBeGreaterThanOrEqual(8);
  });

  it('does nothing without demo agents', () => {
    const registry = new AgentRegistry();
    const seen: Array<[string, EventPost]> = [];
    demoTick(registry, (id, ev) => seen.push([id, ev]));
    expect(seen).toHaveLength(0);
  });

  it('pick() throws on empty input', () => {
    expect(() => pick([])).toThrow();
  });
});
