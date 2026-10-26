import { describe, expect, it } from 'vitest';
import { AgentRegistry, GUEST_CHAT_COOLDOWN_MS } from '../registry';

describe('guest chat (visitor → Difia)', () => {
  it('posts a guest message and reads back only that thread', () => {
    const registry = new AgentRegistry();
    const posted = registry.postGuestMessage('guest-abc123', 'Budi', 'Halo, ini kantor apa?');
    expect('cooldownMs' in posted).toBe(false);
    if ('cooldownMs' in posted) return;
    expect(posted.message.from).toBe('guest');
    expect(posted.message.text).toBe('Halo, ini kantor apa?');
    expect(posted.thread.guestName).toBe('Budi');
    expect(registry.getGuestThread('guest-abc123')?.messages).toHaveLength(1);
    expect(registry.getGuestThread('guest-other')).toBeUndefined();
  });

  it('defaults an empty guest name to Tamu', () => {
    const registry = new AgentRegistry();
    const posted = registry.postGuestMessage('guest-xyz999', undefined, 'Hai');
    if ('cooldownMs' in posted) throw new Error('unexpected cooldown');
    expect(posted.message.guestName).toBe('Tamu');
    expect(posted.thread.guestName).toBe('Tamu');
  });

  it('enforces the 15 s per-thread cooldown', () => {
    const registry = new AgentRegistry();
    registry.postGuestMessage('guest-cool01', undefined, 'Pertama');
    const second = registry.postGuestMessage('guest-cool01', undefined, 'Kedua');
    expect('cooldownMs' in second).toBe(true);
    if ('cooldownMs' in second) {
      expect(second.cooldownMs).toBeGreaterThan(0);
      expect(second.cooldownMs).toBeLessThanOrEqual(GUEST_CHAT_COOLDOWN_MS);
    }
    // A different guest is unaffected by the cooldown.
    const other = registry.postGuestMessage('guest-cool02', undefined, 'Lain');
    expect('cooldownMs' in other).toBe(false);
  });

  it('lists pending messages until replied, then clears them', () => {
    const registry = new AgentRegistry();
    const posted = registry.postGuestMessage('guest-pend01', 'Sari', 'Bisa tanya?');
    if ('cooldownMs' in posted) throw new Error('unexpected cooldown');
    let pending = registry.pendingGuestMessages();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.message.id).toBe(posted.message.id);
    expect(pending[0]?.guestId).toBe('guest-pend01');
    const replied = registry.replyToGuestMessage(posted.message.id, 'difia', 'Tentu, silakan!');
    expect(replied?.reply.from).toBe('difia');
    expect(replied?.thread.messages).toHaveLength(2);
    expect(registry.pendingGuestMessages()).toHaveLength(0);
  });

  it('returns null when replying to an unknown message', () => {
    const registry = new AgentRegistry();
    expect(registry.replyToGuestMessage('nope-1', 'difia', 'Hai')).toBeNull();
  });

  it('sorts threads newest-updated first', () => {
    const registry = new AgentRegistry();
    registry.postGuestMessage('guest-old001', undefined, 'Lama');
    registry.postGuestMessage('guest-new001', undefined, 'Baru');
    const threads = registry.listGuestThreads();
    expect(threads.map((t) => t.guestId)).toEqual(['guest-new001', 'guest-old001']);
  });

  it('survives a snapshot/restore round-trip (backward-compatible)', () => {
    const registry = new AgentRegistry();
    const posted = registry.postGuestMessage('guest-snap01', 'Dewi', 'Simpan aku');
    if ('cooldownMs' in posted) throw new Error('unexpected cooldown');
    registry.replyToGuestMessage(posted.message.id, 'admin', 'Tersimpan.');

    const restored = new AgentRegistry();
    restored.restore(registry.snapshot());
    const thread = restored.getGuestThread('guest-snap01');
    expect(thread?.messages).toHaveLength(2);
    expect(thread?.messages[1]?.from).toBe('admin');

    // A snapshot from before guest chat existed (no fields) still restores.
    const legacy = new AgentRegistry();
    legacy.restore({ agents: [], entryCounter: 0 });
    expect(legacy.listGuestThreads()).toHaveLength(0);
    expect(legacy.getGuestThread('guest-snap01')).toBeUndefined();
  });
});
