import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createWorker,
  del,
  get,
  listWorkers,
  post,
  postForm,
  put,
} from "./api";

function mockFetch(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
) {
  const fn = vi.fn(
    async (url: string, init: RequestInit) => handler(url, init),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("admin api client", () => {
  it("builds the full URL from backendEnv.apiUrl + path", async () => {
    const fetchFn = mockFetch((url) => {
      expect(url).toBe("http://localhost:4000/api/admin/workers?includeArchived=1");
      return jsonResponse({ workers: [] });
    });
    await listWorkers();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("always sends credentials:include", async () => {
    const fetchFn = mockFetch(() => jsonResponse({}));
    await get("/api/admin/config");
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe("include");
  });

  it("sends JSON bodies with the JSON content-type", async () => {
    const fetchFn = mockFetch(() => jsonResponse({ worker: {} }, 201));
    await createWorker({ id: "w1", displayName: "W1" } as never);
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toMatchObject({ id: "w1" });
  });

  it("uses PUT and DELETE methods correctly", async () => {
    const fetchFn = mockFetch(() => jsonResponse({}));
    await put("/api/admin/workers/w1", { displayName: "X" });
    await del("/api/admin/workers/w1");
    expect((fetchFn.mock.calls[0][1] as RequestInit).method).toBe("PUT");
    expect((fetchFn.mock.calls[1][1] as RequestInit).method).toBe("DELETE");
  });

  it("posts multipart FormData without overriding content-type", async () => {
    const fetchFn = mockFetch(() => jsonResponse({ asset: {} }));
    const form = new FormData();
    form.append("id", "a1");
    await postForm("/api/admin/assets", form);
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(form);
    expect(init.headers).toBeUndefined();
  });

  it("throws ApiError with the server's {error} message on !ok", async () => {
    mockFetch(() => jsonResponse({ error: "no such worker" }, 404));
    const err = await post("/api/admin/workers/x", {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).message).toBe("no such worker");
  });

  it("falls back to a generic message when the error body is not {error}", async () => {
    mockFetch(
      () =>
        new Response("oops", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        }),
    );
    const err = await get("/api/admin/workers").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
    expect((err as ApiError).message).toContain("500");
  });

  it("throws ApiError on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const err = await get("/api/admin/workers").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(0);
  });

  it("resolves 204 No Content as undefined", async () => {
    mockFetch(() => new Response(null, { status: 204 }));
    await expect(del("/api/admin/workers/w1")).resolves.toBeUndefined();
  });
});
