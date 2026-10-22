/**
 * `/api/agents` routes — read agent state and ingest agent events.
 *
 *   GET    /api/agents                 → `{ agents: AgentInfo[] }`
 *   GET    /api/agents/:id             → `{ agent: AgentInfo }` | 404
 *   GET    /api/agents/:id/events      → `{ events: ActivityEntry[] }` | 404
 *   POST   /api/agents/:id/events      → `{ agent: AgentInfo }` | 400 | 404-safe
 *
 * The POST endpoint is the ingestion surface for real agents (see
 * `examples/report-agent.mjs`). Bodies are validated with `EventPostSchema`;
 * on success the event is applied to the registry and both an `agent.update`
 * and an `agent.event` are broadcast to WebSocket clients. POST is
 * rate-limited per IP; reads are not.
 *
 * Monitoring only: there is deliberately no endpoint that executes anything.
 */
import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { EventPostSchema } from '@virtual-ai-office/shared';
import type { ServerConfig } from '../config';
import type { AgentRegistry } from '../store';
import type { WsHub } from '../websocket/hub';

const DEFAULT_EVENTS_LIMIT = 50;
const MAX_EVENTS_LIMIT = 200;

function parseLimit(raw: unknown): number {
  if (typeof raw !== 'string') return DEFAULT_EVENTS_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n <= 0) return DEFAULT_EVENTS_LIMIT;
  return Math.min(n, MAX_EVENTS_LIMIT);
}

/** Express 5 types route params as `string | string[]`; we only use single-segment ids. */
function firstParam(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return raw[0] ?? '';
  return raw ?? '';
}

export function createAgentsRouter(
  registry: AgentRegistry,
  hub: WsHub,
  config: ServerConfig,
): Router {
  const router = Router();

  const postLimiter = rateLimit({
    windowMs: 60_000,
    limit: config.rateLimitPerMinute,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded — slow down and retry.' },
  });

  router.get('/', (_req: Request, res: Response) => {
    res.json({ agents: registry.list() });
  });

  router.get('/:id', (req: Request, res: Response) => {
    const agentId = firstParam(req.params.id);
    const agent = registry.get(agentId);
    if (!agent) {
      res.status(404).json({ error: `Unknown agent: ${firstParam(req.params.id)}` });
      return;
    }
    res.json({ agent });
  });

  router.get('/:id/events', (req: Request, res: Response) => {
    const events = registry.recentEvents(firstParam(req.params.id), parseLimit(req.query.limit));
    if (!events) {
      res.status(404).json({ error: `Unknown agent: ${firstParam(req.params.id)}` });
      return;
    }
    res.json({ events });
  });

  router.post('/:id/events', postLimiter, (req: Request, res: Response) => {
    const parsed = EventPostSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid event payload', details: parsed.error.flatten() });
      return;
    }

    const { agent, entry } = registry.upsertFromEvent(firstParam(req.params.id), parsed.data);

    hub.broadcast({ type: 'agent.update', agent });
    if (entry) {
      hub.broadcast({ type: 'agent.event', agentId: agent.id, entry });
    }

    res.status(200).json({ agent });
  });

  return router;
}
