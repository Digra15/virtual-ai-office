import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGuestPresenceStore } from "./useGuestPresenceStore";

function okFetch(active: boolean) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ guestActive: active }),
  })) as unknown as typeof fetch;
}

function statusFetch(status: number) {
  return vi.fn(async () => ({
    ok: false,
    status,
    json: async () => ({}),
  })) as unknown as typeof fetch;
}

describe("guest presence store", () => {
  beforeEach(() => {
    useGuestPresenceStore.setState({
      remoteActive: null,
      remoteUnavailable: false,
      localActive: false,
      guestActive: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adopts the remote answer when the route works", async () => {
    vi.stubGlobal("fetch", okFetch(true));
    await useGuestPresenceStore.getState().fetchRemote();
    expect(useGuestPresenceStore.getState().guestActive).toBe(true);
    expect(useGuestPresenceStore.getState().remoteActive).toBe(true);
    const url = String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]);
    expect(url).toContain("/api/guest-chat/presence");

    vi.stubGlobal("fetch", okFetch(false));
    await useGuestPresenceStore.getState().fetchRemote();
    expect(useGuestPresenceStore.getState().guestActive).toBe(false);
  });

  it("falls back to the local signal on 404 (old Worker without the route)", async () => {
    const s = useGuestPresenceStore.getState();
    s.setLocalActive(true);
    expect(useGuestPresenceStore.getState().guestActive).toBe(true);
    vi.stubGlobal("fetch", statusFetch(404));
    await useGuestPresenceStore.getState().fetchRemote();
    const st = useGuestPresenceStore.getState();
    expect(st.remoteUnavailable).toBe(true);
    expect(st.remoteActive).toBeNull();
    expect(st.guestActive).toBe(true); // local signal kept

    useGuestPresenceStore.getState().setLocalActive(false);
    vi.stubGlobal("fetch", statusFetch(404));
    await useGuestPresenceStore.getState().fetchRemote();
    expect(useGuestPresenceStore.getState().guestActive).toBe(false);
  });

  it("keeps the previous signal on transient failure (offline / 5xx)", async () => {
    vi.stubGlobal("fetch", okFetch(true));
    await useGuestPresenceStore.getState().fetchRemote();
    expect(useGuestPresenceStore.getState().guestActive).toBe(true);

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch);
    await useGuestPresenceStore.getState().fetchRemote();
    expect(useGuestPresenceStore.getState().guestActive).toBe(true);

    vi.stubGlobal("fetch", statusFetch(500));
    await useGuestPresenceStore.getState().fetchRemote();
    expect(useGuestPresenceStore.getState().guestActive).toBe(true);
  });

  it("local signal never overrides a known remote answer", () => {
    vi.stubGlobal("fetch", okFetch(true));
    return useGuestPresenceStore
      .getState()
      .fetchRemote()
      .then(() => {
        useGuestPresenceStore.getState().setLocalActive(false);
        expect(useGuestPresenceStore.getState().guestActive).toBe(true);
      });
  });
});
