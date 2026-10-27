import { describe, expect, it } from 'vitest';
import { AgentRegistry, LIVE_SEEDS } from '../registry';

describe('live seats (no demo)', () => {
  it('seeds exactly the 3 live agents, idempotently', () => {
    const registry = new AgentRegistry();
    expect(registry.seedLiveAgents()).toBe(3);
    expect(registry.seedLiveAgents()).toBe(0);
    const agents = registry.list();
    expect(agents).toHaveLength(3);
    expect(agents.every((a) => a.source === 'live')).toBe(true);
    expect(agents.map((a) => a.id).sort()).toEqual(['difia', 'kirana', 'reno']);
    expect(agents.map((a) => a.name).sort()).toEqual(['Difia', 'Kirana', 'Reno']);
    const difia = agents.find((a) => a.id === 'difia');
    expect(difia?.role).toBe('Receptionist');
    expect(difia?.workstationId).toBe('reception');
    expect(agents.find((a) => a.id === 'kirana')?.workstationId).toBe('ws-01');
    expect(agents.find((a) => a.id === 'reno')?.workstationId).toBe('ws-02');
    expect(LIVE_SEEDS.map((s) => s.id).sort()).toEqual(['difia', 'kirana', 'reno']);
  });

  it('purges demo agents but keeps live ones', () => {
    const registry = new AgentRegistry();
    registry.seedDemoAgents();
    registry.seedLiveAgents();
    expect(registry.list()).toHaveLength(11);
    expect(registry.purgeDemoAgents()).toBe(8);
    expect(registry.list().map((a) => a.id).sort()).toEqual(['difia', 'kirana', 'reno']);
  });

  it('first report for a live seat uses its proper identity', () => {
    const registry = new AgentRegistry();
    const { agent } = registry.upsertFromEvent('kirana', { type: 'status', status: 'working' });
    expect(agent.name).toBe('Kirana');
    expect(agent.role).toBe('Writer');
    expect(agent.workstationId).toBe('ws-01');
    expect(agent.source).toBe('live');
  });

  it('first report for an unknown id stays a generic external agent', () => {
    const registry = new AgentRegistry();
    const { agent } = registry.upsertFromEvent('ext-9', { type: 'heartbeat' });
    expect(agent.name).toBe('ext-9');
    expect(agent.role).toBe('External Agent');
    expect(agent.workstationId).toBe('ws-remote');
  });
});

describe('task queue', () => {
  it('creates, lists (filtered), and completes tasks idempotently', () => {
    const registry = new AgentRegistry();
    registry.seedLiveAgents();
    const t1 = registry.createTask('kirana', 'Write chapter 26', 'Laras confronts Raka');
    const t2 = registry.createTask('kirana', 'Edit chapter 25');
    registry.createTask('reno', 'Fix the spawn bug');
    expect(registry.listTasks('kirana')).toHaveLength(2);
    expect(registry.listTasks('kirana', 'pending')).toHaveLength(2);
    expect(registry.listTasks('kirana', 'done')).toHaveLength(0);
    const done = registry.completeTask('kirana', t1.id);
    expect(done?.status).toBe('done');
    expect(done?.completedAt).not.toBeNull();
    expect(registry.listTasks('kirana', 'pending')).toHaveLength(1);
    expect(registry.listTasks('kirana', 'done')).toHaveLength(1);
    // Double-complete is idempotent, not an error.
    expect(registry.completeTask('kirana', t1.id)?.status).toBe('done');
    expect(t2.id).not.toBe(t1.id);
  });

  it('rejects foreign or unknown tasks', () => {
    const registry = new AgentRegistry();
    registry.seedLiveAgents();
    const t = registry.createTask('kirana', 'Write chapter 26');
    expect(registry.completeTask('reno', t.id)).toBeNull();
    expect(registry.completeTask('kirana', 'nope')).toBeNull();
  });

  it('persists tasks across snapshot/restore', () => {
    const registry = new AgentRegistry();
    registry.seedLiveAgents();
    const t = registry.createTask('reno', 'Fix the spawn bug');
    registry.completeTask('reno', t.id);
    const restored = new AgentRegistry();
    restored.restore(registry.snapshot());
    expect(restored.listTasks('reno', 'done')).toHaveLength(1);
    expect(restored.listTasks('reno', 'done')[0]?.title).toBe('Fix the spawn bug');
  });
});
