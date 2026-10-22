import { beforeEach, describe, expect, it } from "vitest";
import { useSceneReadyStore } from "./useSceneReadyStore";

beforeEach(() => {
  useSceneReadyStore.setState({ ready: false });
});

describe("useSceneReadyStore (first-frame gate)", () => {
  it("starts not ready", () => {
    expect(useSceneReadyStore.getState().ready).toBe(false);
  });

  it("markReady() flips ready to true", () => {
    useSceneReadyStore.getState().markReady();
    expect(useSceneReadyStore.getState().ready).toBe(true);
  });

  it("reset() returns ready to false", () => {
    const s = useSceneReadyStore.getState();
    s.markReady();
    expect(useSceneReadyStore.getState().ready).toBe(true);
    s.reset();
    expect(useSceneReadyStore.getState().ready).toBe(false);
  });
});
