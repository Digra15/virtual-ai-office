import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeHiddenWorkerIds,
  parsePublicConfig,
  parsePublicWorkers,
  useOfficeConfigStore,
} from "./useOfficeConfigStore";
import {
  clearCharacterPresetOverride,
  getCharacterPreset,
} from "../world/characters/characterPresets";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useOfficeConfigStore.setState({
    branding: null,
    theme: null,
    visibility: null,
    camera: null,
    workers: [],
    hiddenWorkerIds: [],
    loaded: false,
    error: null,
  });
});

describe("useOfficeConfigStore", () => {
  it("parses the public config payload defensively", () => {
    const parsed = parsePublicConfig({
      branding: { officeName: "Acme", primaryColor: "#ff0000", accentColor: "#00ff00" },
      theme: "dawn",
      visibility: { publicScene: true, showOffline: false },
      camera: { position: [1, 2, 3], target: [0, 0, 0], fov: 50 },
      extra: "ignored",
    });
    expect(parsed.branding?.officeName).toBe("Acme");
    expect(parsed.theme).toBe("dawn");
    expect(parsed.visibility?.showOffline).toBe(false);
    expect(parsed.camera?.fov).toBe(50);
  });

  it("parsePublicConfig tolerates garbage", () => {
    const parsed = parsePublicConfig(null);
    expect(parsed.branding).toBeNull();
    expect(parsePublicConfig({ branding: { officeName: "" } }).branding).toBeNull();
  });

  it("parsePublicWorkers accepts a bare array or {workers}", () => {
    const w = {
      id: "nika",
      displayName: "Nika",
      role: "assistant",
      description: "",
      status: "idle",
      lastSeen: null,
      currentTask: "",
      workstationId: "",
      characterModel: "procedural-chibi",
      characterConfig: {},
      accentColor: "#38bdf8",
      animationProfile: "default",
      services: [],
      sortOrder: 0,
    };
    expect(parsePublicWorkers([w])).toHaveLength(1);
    expect(parsePublicWorkers({ workers: [w] })).toHaveLength(1);
    expect(parsePublicWorkers({ workers: [{ id: "bad" }] })).toHaveLength(0);
    expect(parsePublicWorkers(null)).toHaveLength(0);
  });

  it("computeHiddenWorkerIds only flags explicit publicVisible=false", () => {
    expect(
      computeHiddenWorkerIds([
        { id: "a", publicVisible: false },
        { id: "b", publicVisible: true },
        { id: "c" },
      ]),
    ).toEqual(["a"]);
  });

  it("fetchPublic stores branding/workers and marks loaded", async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        String(url).endsWith("/api/public/config")
          ? { branding: { officeName: "Acme" } }
          : [],
    }));
    vi.stubGlobal("fetch", fetchMock);
    await useOfficeConfigStore.getState().fetchPublic("https://api.example.com");
    const s = useOfficeConfigStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.branding?.officeName).toBe("Acme");
    expect(s.hiddenWorkerIds).toEqual([]);
  });

  it("applyOverrides installs valid characterConfig presets and clears stale ones", async () => {
    const valid = {
      id: "nika",
      displayName: "Nika",
      role: "assistant",
      description: "",
      status: "idle",
      lastSeen: null,
      currentTask: "",
      workstationId: "",
      characterModel: "procedural-chibi",
      characterConfig: {
        hairStyle: "hime",
        hairColor: "#111111",
        eyeColor: "#222222",
        skinTone: "#ffd9b8",
        outfitStyle: "sweater",
        outfitPrimary: "#333333",
        outfitSecondary: "#444444",
        accessory: "ribbon",
      },
      accentColor: "#38bdf8",
      animationProfile: "default",
      services: [],
      sortOrder: 0,
    };
    useOfficeConfigStore.setState({
      workers: [valid] as never,
      hiddenWorkerIds: [],
    });
    useOfficeConfigStore.getState().applyOverrides();
    expect(getCharacterPreset("nika").hairColor).toBe("#111111");

    // Worker disappears → override cleared, built-in preset restored.
    useOfficeConfigStore.setState({ workers: [] });
    useOfficeConfigStore.getState().applyOverrides();
    clearCharacterPresetOverride("nika");
    expect(getCharacterPreset("nika").hairStyle).toBe("hime"); // built-in preset
  });
});
