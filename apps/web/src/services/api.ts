import type { ActivityEntry, AgentInfo } from "@virtual-ai-office/shared";

/** Thrown when the backend answers with a non-2xx status. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new ApiError(
      0,
      `Could not reach ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new ApiError(res.status, `Request failed with status ${res.status}: ${url}`);
  }
  return (await res.json()) as T;
}

const trimSlash = (base: string) => base.replace(/\/+$/, "");

export async function fetchAgents(apiUrl: string): Promise<AgentInfo[]> {
  const body = await request<{ agents: AgentInfo[] }>(
    `${trimSlash(apiUrl)}/api/agents`,
  );
  return body.agents;
}

export async function fetchAgent(apiUrl: string, id: string): Promise<AgentInfo> {
  const body = await request<{ agent: AgentInfo }>(
    `${trimSlash(apiUrl)}/api/agents/${encodeURIComponent(id)}`,
  );
  return body.agent;
}

export async function fetchEvents(
  apiUrl: string,
  id: string,
  limit = 30,
): Promise<ActivityEntry[]> {
  const body = await request<{ events: ActivityEntry[] }>(
    `${trimSlash(apiUrl)}/api/agents/${encodeURIComponent(id)}/events?limit=${limit}`,
  );
  return body.events;
}
