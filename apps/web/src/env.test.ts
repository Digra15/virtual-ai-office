import { describe, expect, it } from "vitest";
import {
  DEFAULT_API_URL,
  DEFAULT_WS_URL,
  resolveBackendEnv,
} from "./env";

describe("resolveBackendEnv", () => {
  it("dev falls back to localhost", () => {
    const env = resolveBackendEnv({ DEV: true });
    expect(env.configured).toBe(true);
    expect(env.apiUrl).toBe("http://localhost:4000");
    expect(env.wsUrl).toBe("ws://localhost:4000/ws");
  });

  it("dev honors explicit vars", () => {
    const env = resolveBackendEnv({
      DEV: true,
      VITE_API_URL: "https://api.example.test",
      VITE_WS_URL: "wss://api.example.test/ws",
    });
    expect(env.apiUrl).toBe("https://api.example.test");
    expect(env.wsUrl).toBe("wss://api.example.test/ws");
  });

  it("production honors explicit vars", () => {
    const env = resolveBackendEnv({
      DEV: false,
      VITE_API_URL: "https://api.example.test",
      VITE_WS_URL: "wss://api.example.test/ws",
    });
    expect(env.configured).toBe(true);
    expect(env.apiUrl).toBe("https://api.example.test");
    expect(env.wsUrl).toBe("wss://api.example.test/ws");
  });

  it("production without vars falls back to the live Worker (never demo)", () => {
    const env = resolveBackendEnv({ DEV: false });
    expect(env.configured).toBe(true);
    expect(env.apiUrl).toBe(DEFAULT_API_URL);
    expect(env.wsUrl).toBe(DEFAULT_WS_URL);
    expect(DEFAULT_API_URL).toContain("dalikamira.workers.dev");
  });

  it("production falls back per variable, not all-or-nothing", () => {
    const env = resolveBackendEnv({
      DEV: false,
      VITE_API_URL: "https://api.example.test",
    });
    expect(env.apiUrl).toBe("https://api.example.test");
    expect(env.wsUrl).toBe(DEFAULT_WS_URL);
  });
});
