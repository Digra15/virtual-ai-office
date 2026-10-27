/**
 * Seat-id validation + seat removal (insiden kursi junk `--help`,
 * 2026-10-27): a CLI flag passed as a seat id must never create a seat,
 * and a junk seat must be removable, permanently.
 *
 * Route-level HTTP mapping (DELETE unknown id → 404, POST/WS invalid id
 * → 400/error) lives in room.ts, which imports `cloudflare:workers` and
 * cannot be imported in these node-env tests; the mapping follows the
 * existing GET-agent 404 pattern by code read, and the registry-level
 * behavior it maps from is covered here.
 */
import { describe, expect, it } from 'vitest';
import { AgentRegistry, isValidAgentId, normalizeAgentId } from '../registry';

describe('isValidAgentId', () => {
  it('accepts the founder seats and ordinary normalized ids', () => {
    for (const id of ['difia', 'kirana', 'reno', 'tara', 'a', 'a-1', 'x_y', 'abc123', 'ext-9']) {
      expect(isValidAgentId(id)).toBe(true);
    }
  });

  it('rejects empty, flag-like, spaced, and symbol ids', () => {
    for (const id of ['', '--help', '-x', '-', '_abc', 'a b', 'a.b', 'a@b', 'a/b', 'a'.repeat(51)]) {
      expect(isValidAgentId(id)).toBe(false);
    }
  });

  it('normalization does not rescue a flag: --help stays invalid', () => {
    expect(normalizeAgentId('--help')).toBe('--help');
    expect(isValidAgentId(normalizeAgentId('--help'))).toBe(false);
    expect(isValidAgentId(normalizeAgentId(' Tara '))).toBe(true);
  });
});

describe('removeAgent', () => {
  it('removes the seat and its queued tasks; second removal reports false', () => {
    const registry = new AgentRegistry();
    registry.upsertFromEvent('tara', { type: 'heartbeat', name: 'Tara', role: 'Designer' });
    registry.createTask('tara', 'Desain poster', 'Brief singkat');
    expect(registry.list()).toHaveLength(1);
    expect(registry.listTasks('tara')).toHaveLength(1);

    expect(registry.removeAgent('tara')).toBe(true);
    expect(registry.get('tara')).toBeUndefined();
    expect(registry.list()).toHaveLength(0);
    expect(registry.listTasks('tara')).toHaveLength(0);
    expect(registry.removeAgent('tara')).toBe(false);
  });

  it('returns false for an unknown id', () => {
    const registry = new AgentRegistry();
    expect(registry.removeAgent('tidak-ada')).toBe(false);
  });

  it('a removed seat stays gone after snapshot/restore', () => {
    const before = new AgentRegistry();
    before.upsertFromEvent('tara', { type: 'heartbeat', name: 'Tara', role: 'Designer' });
    before.createTask('tara', 'Desain poster');

    const restored = new AgentRegistry();
    restored.restore(before.snapshot());
    expect(restored.get('tara')).toBeDefined();
    expect(restored.listTasks('tara')).toHaveLength(1);

    expect(restored.removeAgent('tara')).toBe(true);
    const after = new AgentRegistry();
    after.restore(restored.snapshot());
    expect(after.get('tara')).toBeUndefined();
    expect(after.list()).toHaveLength(0);
    expect(after.listTasks('tara')).toHaveLength(0);
  });

  it('removing one seat leaves other seats untouched', () => {
    const registry = new AgentRegistry();
    registry.upsertFromEvent('tara', { type: 'heartbeat', name: 'Tara', role: 'Designer' });
    registry.upsertFromEvent('dito', { type: 'heartbeat', name: 'Dito', role: 'Coder' });
    expect(registry.removeAgent('tara')).toBe(true);
    expect(registry.get('dito')).toBeDefined();
    expect(registry.list()).toHaveLength(1);
  });
});
