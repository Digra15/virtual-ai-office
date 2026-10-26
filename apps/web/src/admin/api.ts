/**
 * Typed REST client for the /api/admin (and /api/public) Worker API.
 *
 * Every request carries `credentials: "include"` — the admin session is an
 * httpOnly cookie the JS never sees. The base URL is backendEnv.apiUrl
 * (VITE_API_URL); callers must check backendEnv.configured before calling.
 */
import {
  ADMIN_API,
  PUBLIC_API,
  type AdminUser,
  type AssetManifestEntry,
  type AuditEntry,
  type ErrorEvent,
  type ErrorEventCreate,
  type ErrorEventStatus,
  type Order,
  type OrderCreate,
  type OrderPayment,
  type OrderTransition,
  type Service,
  type ServiceCreate,
  type ServiceUpdate,
  type SiteConfig,
  type Worker,
  type WorkerCreate,
  type WorkerUpdate,
} from "@virtual-ai-office/shared";
import { backendEnv } from "../env";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
}

async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const url = `${backendEnv.apiUrl}${path}`;
  const init: RequestInit = { method, credentials: "include" };
  if (opts.form) {
    init.body = opts.form; // browser sets multipart content-type + boundary
  } else if (opts.body !== undefined) {
    init.headers = { "Content-Type": "application/json", ...opts.headers };
    init.body = JSON.stringify(opts.body);
  } else if (opts.headers) {
    init.headers = opts.headers;
  }
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(0, `Network error reaching ${url}`);
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: unknown };
      if (typeof data?.error === "string" && data.error) message = data.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return undefined as T;
  return (await res.json()) as T;
}

export const get = <T>(path: string): Promise<T> => request<T>("GET", path);
export const post = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>("POST", path, { body });
export const put = <T>(path: string, body: unknown): Promise<T> =>
  request<T>("PUT", path, { body });
export const del = <T>(path: string): Promise<T> => request<T>("DELETE", path);
export const patch = <T>(path: string, body: unknown): Promise<T> =>
  request<T>("PATCH", path, { body });
export const postForm = <T>(path: string, form: FormData): Promise<T> =>
  request<T>("POST", path, { form });

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const apiSetup = (body: {
  username: string;
  password: string;
  setupToken: string;
}): Promise<{ user: AdminUser }> => post(ADMIN_API.setup, body);

export const apiLogin = (body: {
  username: string;
  password: string;
}): Promise<{ user: AdminUser }> => post(ADMIN_API.login, body);

export const apiLogout = (): Promise<unknown> => post(ADMIN_API.logout);

export const apiMe = (): Promise<{ user: AdminUser }> => get(ADMIN_API.me);

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

export const listWorkers = (includeArchived = true): Promise<{ workers: Worker[] }> =>
  get(`${ADMIN_API.workers}?includeArchived=${includeArchived ? 1 : 0}`);

export const createWorker = (body: WorkerCreate): Promise<{ worker: Worker }> =>
  post(ADMIN_API.workers, body);

export const getWorker = (id: string): Promise<{ worker: Worker }> =>
  get(ADMIN_API.worker(id));

export const updateWorker = (
  id: string,
  body: WorkerUpdate,
): Promise<{ worker: Worker }> => put(ADMIN_API.worker(id), body);

export const deleteWorker = (id: string): Promise<{ worker: Worker }> =>
  del(ADMIN_API.worker(id));

export const restoreWorker = (id: string): Promise<{ worker: Worker }> =>
  post(`${ADMIN_API.worker(id)}/restore`);

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export const listServices = (): Promise<{ services: Service[] }> =>
  get(ADMIN_API.services);

export const createService = (body: ServiceCreate): Promise<{ service: Service }> =>
  post(ADMIN_API.services, body);

export const updateService = (
  id: string,
  body: ServiceUpdate,
): Promise<{ service: Service }> => put(ADMIN_API.service(id), body);

export const deleteService = (id: string): Promise<{ service: Service }> =>
  del(ADMIN_API.service(id));

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const listOrders = (): Promise<{ orders: Order[] }> =>
  get(ADMIN_API.orders);

export const createOrder = (body: OrderCreate): Promise<{ order: Order }> =>
  post(ADMIN_API.orders, body);

export const getOrder = (id: string): Promise<{ order: Order }> =>
  get(ADMIN_API.order(id));

export const transitionOrder = (
  id: string,
  body: OrderTransition,
): Promise<{ order: Order }> => post(ADMIN_API.orderTransition(id), body);

export const markOrderPaid = (
  id: string,
  body: OrderPayment,
): Promise<{ order: Order }> => post(ADMIN_API.orderPayment(id), body);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const getConfig = (): Promise<{ config: Record<string, unknown> }> =>
  get(ADMIN_API.config);

export const putConfigKey = (
  key: string,
  value: unknown,
): Promise<{ key: string; value: unknown }> =>
  put(ADMIN_API.configKey(key), { value });

// ---------------------------------------------------------------------------
// Runtime site settings (DO storage, no D1 needed)
// ---------------------------------------------------------------------------

/** Public read of the runtime site settings. */
export const getSiteConfig = (): Promise<{ config: SiteConfig }> =>
  get("/api/config");

/**
 * Replace the runtime site settings. Bearer auth (interim): the caller
 * passes the agent secret, which must never be stored outside the tab
 * session (see SettingsPage). The session cookie is NOT accepted here —
 * the endpoint checks the bearer only.
 */
export const postSiteConfig = (
  body: SiteConfig,
  token: string,
): Promise<{ config: SiteConfig }> =>
  request("POST", "/api/config", {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export const listAssets = (): Promise<{ assets: AssetManifestEntry[] }> =>
  get(ADMIN_API.assets);

export const uploadAsset = (
  file: File,
  fields: { id: string; attribution: string; license: string },
): Promise<{ asset: AssetManifestEntry }> => {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("id", fields.id);
  form.append("attribution", fields.attribution);
  form.append("license", fields.license);
  return postForm(ADMIN_API.assets, form);
};

export const deleteAsset = (id: string): Promise<{ asset: AssetManifestEntry }> =>
  del(ADMIN_API.asset(id));

// ---------------------------------------------------------------------------
// Error events (recovery workflow)
// ---------------------------------------------------------------------------

export const listErrorEvents = (): Promise<{ events: ErrorEvent[] }> =>
  get(ADMIN_API.errorEvents);

export const createErrorEvent = (
  body: ErrorEventCreate,
): Promise<{ event: ErrorEvent }> => post(ADMIN_API.errorEvents, body);

export const updateErrorEvent = (
  id: string,
  body: { status: ErrorEventStatus; note?: string },
): Promise<{ event: ErrorEvent }> => patch(ADMIN_API.errorEvent(id), body);

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const listAudit = (
  limit = 100,
): Promise<{ entries: AuditEntry[] }> =>
  get(`${ADMIN_API.audit}?limit=${encodeURIComponent(String(limit))}`);

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export const getPublicConfig = (): Promise<unknown> => get(PUBLIC_API.config);
export const getPublicWorkers = (): Promise<unknown> => get(PUBLIC_API.workers);
export const getPublicServices = (): Promise<unknown> => get(PUBLIC_API.services);

/** Worker health probe (root /health on the API Worker). */
export const getHealth = (): Promise<unknown> =>
  get("/health");

// ---------------------------------------------------------------------------
// Guest chat (visitor threads live in the DO; the admin API forwards)
// ---------------------------------------------------------------------------

export const listGuestThreads = (): Promise<{ threads: import("@virtual-ai-office/shared").GuestThread[] }> =>
  get("/api/admin/guest-chat");

export const replyGuestChat = (
  messageId: string,
  text: string,
): Promise<{ reply: import("@virtual-ai-office/shared").GuestChatMessage }> =>
  post(`/api/admin/guest-chat/${encodeURIComponent(messageId)}/reply`, { text });
