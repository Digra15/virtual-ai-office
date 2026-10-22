import { afterEach, describe, expect, it, vi } from "vitest";
import { connectSocket } from "./socket";

/** Minimal fake WebSocket capturing instances for the test. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  readyState = 0;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  sent: string[] = [];
  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWebSocket.instances = [];
});

function connect(extra: Record<string, () => void> = {}) {
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
  const calls = {
    onSnapshot: vi.fn(),
    onUpdate: vi.fn(),
    onEvent: vi.fn(),
    onHeartbeat: vi.fn(),
    onStatus: vi.fn(),
    ...extra,
  };
  const disconnect = connectSocket({ wsUrl: "ws://x/ws", ...calls });
  const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  ws.open();
  return { disconnect, ws, calls };
}

describe("connectSocket admin broadcasts", () => {
  it("dispatches config.update to onConfigUpdate", () => {
    const onConfigUpdate = vi.fn();
    const { ws, disconnect } = connect({ onConfigUpdate });
    ws.receive({ type: "config.update" });
    expect(onConfigUpdate).toHaveBeenCalledTimes(1);
    disconnect();
  });

  it("dispatches workers.update and services.update", () => {
    const onWorkersUpdate = vi.fn();
    const onServicesUpdate = vi.fn();
    const { ws, disconnect } = connect({ onWorkersUpdate, onServicesUpdate });
    ws.receive({ type: "workers.update" });
    ws.receive({ type: "services.update" });
    expect(onWorkersUpdate).toHaveBeenCalledTimes(1);
    expect(onServicesUpdate).toHaveBeenCalledTimes(1);
    disconnect();
  });

  it("ignores unknown broadcast types without crashing", () => {
    const onConfigUpdate = vi.fn();
    const { ws, disconnect } = connect({ onConfigUpdate });
    ws.receive({ type: "something.else" });
    ws.receive("not json{{{");
    expect(onConfigUpdate).not.toHaveBeenCalled();
    disconnect();
  });

  it("keeps working when the optional callbacks are absent", () => {
    const { ws, calls, disconnect } = connect();
    ws.receive({ type: "config.update" });
    ws.receive({
      type: "snapshot",
      agents: [],
      demoMode: true,
    });
    expect(calls.onSnapshot).toHaveBeenCalledTimes(1);
    disconnect();
  });
});
