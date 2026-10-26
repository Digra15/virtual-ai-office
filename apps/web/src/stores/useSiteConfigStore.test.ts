import { afterEach, describe, expect, it, vi } from "vitest";
import { useSiteConfigStore } from "./useSiteConfigStore";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useSiteConfigStore.setState({ config: null, loaded: false, error: null });
});

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })),
  );
}

describe("useSiteConfigStore", () => {
  it("stores a valid config payload", async () => {
    mockFetch(200, {
      config: {
        officeName: "Acme",
        announcement: "Rapat 10:00",
        offlineTimeoutMs: 300_000,
      },
    });
    await useSiteConfigStore.getState().fetchSiteConfig("https://api.example.test");
    const s = useSiteConfigStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.config?.officeName).toBe("Acme");
    expect(s.config?.offlineTimeoutMs).toBe(300_000);
  });

  it("keeps config null on a failed request", async () => {
    mockFetch(500, { error: "boom" });
    await useSiteConfigStore.getState().fetchSiteConfig("https://api.example.test");
    const s = useSiteConfigStore.getState();
    expect(s.loaded).toBe(false);
    expect(s.config).toBeNull();
    expect(s.error).toBeTruthy();
  });

  it("rejects a payload that fails schema validation", async () => {
    mockFetch(200, { config: { officeName: "", announcement: "", offlineTimeoutMs: 1 } });
    await useSiteConfigStore.getState().fetchSiteConfig("https://api.example.test");
    const s = useSiteConfigStore.getState();
    expect(s.loaded).toBe(false);
    expect(s.config).toBeNull();
  });
});
