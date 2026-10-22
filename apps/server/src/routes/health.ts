/**
 * `GET /health` — liveness probe.
 *
 * Returns only non-sensitive operational facts: status, uptime, demo mode,
 * connected client count, agent count and the server version.
 */
import { Router, type Request, type Response } from 'express';
import type { HealthResponse } from '@virtual-ai-office/shared';
import type { ServerConfig } from '../config';
import type { AgentRegistry } from '../store';
import type { WsHub } from '../websocket/hub';

export function createHealthRouter(
  registry: AgentRegistry,
  hub: WsHub,
  config: ServerConfig,
  startedAtMs: number,
): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    const body: HealthResponse = {
      status: 'ok',
      uptimeSec: Math.floor((Date.now() - startedAtMs) / 1000),
      demoMode: config.demoMode,
      connectedClients: hub.clientCount,
      agentCount: registry.list().length,
      version: config.version,
    };
    res.json(body);
  });

  return router;
}
