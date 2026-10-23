/**
 * Recording mock for CanvasRenderingContext2D.
 *
 * jsdom has no canvas 2D context, so the cozy `draw*` functions are tested
 * against this proxy: every method call and property set is recorded and
 * can be asserted on. Any property *read* returns a no-op recorder
 * function (draw code must not depend on reading ctx state back).
 */
export type CtxRecord =
  | { type: "call"; method: string; args: unknown[] }
  | { type: "set"; prop: string; value: unknown };

export interface MockCtx {
  ctx: CanvasRenderingContext2D;
  records: CtxRecord[];
  /** All arg-lists for calls to `method`, in order. */
  calls(method: string): unknown[][];
  /** All values assigned to `prop`, in order. */
  sets(prop: string): unknown[];
}

export function createMockCtx(): MockCtx {
  const records: CtxRecord[] = [];
  const proxy = new Proxy<Record<string | symbol, unknown>>(
    {},
    {
      get(_t, prop) {
        return (...args: unknown[]) => {
          records.push({ type: "call", method: String(prop), args });
        };
      },
      set(_t, prop, value) {
        records.push({ type: "set", prop: String(prop), value });
        return true;
      },
    },
  );
  return {
    ctx: proxy as unknown as CanvasRenderingContext2D,
    records,
    calls(method: string) {
      return records
        .filter((r) => r.type === "call" && r.method === method)
        .map((r) => (r as { args: unknown[] }).args);
    },
    sets(prop: string) {
      return records
        .filter((r) => r.type === "set" && r.prop === prop)
        .map((r) => (r as { value: unknown }).value);
    },
  };
}
