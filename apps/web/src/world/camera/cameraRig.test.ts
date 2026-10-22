import { beforeEach, describe, expect, it } from "vitest";
import { useCameraStore } from "../../stores/useCameraStore";
import { useBuildingViewStore } from "../../stores/useBuildingViewStore";

beforeEach(() => {
  useCameraStore.setState({
    focusRequest: null,
    resetNonce: 0,
    viewNonce: 0,
    roomRequest: null,
  });
  useBuildingViewStore.setState({ floorMode: "entire" });
});

describe("camera store (rig request logic)", () => {
  it("requestView sets the building floor mode and bumps viewNonce", () => {
    const before = useCameraStore.getState().viewNonce;
    useCameraStore.getState().requestView("ground");
    expect(useBuildingViewStore.getState().floorMode).toBe("ground");
    expect(useCameraStore.getState().viewNonce).toBe(before + 1);

    useCameraStore.getState().requestView("second");
    expect(useBuildingViewStore.getState().floorMode).toBe("second");
    expect(useCameraStore.getState().viewNonce).toBe(before + 2);
  });

  it("requestView on the same mode still bumps the nonce (re-tween)", () => {
    useCameraStore.getState().requestView("outdoor");
    const nonce = useCameraStore.getState().viewNonce;
    useCameraStore.getState().requestView("outdoor");
    expect(useCameraStore.getState().viewNonce).toBe(nonce + 1);
  });

  it("requestRoom sets roomRequest with increasing nonces", () => {
    useCameraStore.getState().requestRoom("lab");
    const first = useCameraStore.getState().roomRequest;
    expect(first).toMatchObject({ roomId: "lab" });

    useCameraStore.getState().requestRoom("terrace");
    const second = useCameraStore.getState().roomRequest;
    expect(second).toMatchObject({ roomId: "terrace" });
    expect(second!.nonce).toBeGreaterThan(first!.nonce);
  });

  it("requestReset still bumps resetNonce only", () => {
    const s = useCameraStore.getState();
    const resetBefore = s.resetNonce;
    const viewBefore = s.viewNonce;
    s.requestReset();
    expect(useCameraStore.getState().resetNonce).toBe(resetBefore + 1);
    expect(useCameraStore.getState().viewNonce).toBe(viewBefore);
    expect(useCameraStore.getState().focusRequest).toBeNull();
  });

  it("requestFocus keeps its nonce-bump behavior", () => {
    useCameraStore.getState().requestFocus("a1", [1, 1.2, 2]);
    const first = useCameraStore.getState().focusRequest;
    expect(first).toMatchObject({ agentId: "a1" });

    useCameraStore.getState().requestFocus("a2", [3, 1.2, 4]);
    const second = useCameraStore.getState().focusRequest;
    expect(second!.nonce).toBeGreaterThan(first!.nonce);
  });
});
