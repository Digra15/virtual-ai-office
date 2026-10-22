/**
 * Virtual AI Office backend — monitoring-only agent status server.
 *
 * Wires together:
 *   - Express REST API (`/health`, `/api/agents`)
 *   - WebSocket hub on `/ws` (live snapshots + event fan-out)
 *   - `AgentRegistry` (in-memory single source of truth)
 *   - `DemoAdapter` (clearly-labeled simulated agents, only when `demoMode`)
 *   - Offline sweeper (marks silent agents `offline`)
 *
 * `createApp()` builds everything without listening, so tests can import it
 * and drive the Express app via supertest. The server only listens when this
 * file is run directly (`node dist/index.js`).
 *
 * Monitoring only: there is no endpoint that executes commands or mutates
 * anything outside this process, and responses never include secrets.
 */
import http from 'http';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import type { EventPost } from '@virtual-ai-office/shared';
import { loadConfig, type ServerConfig } from './config';
import { AgentRegistry } from './store';
import { WsHub } from './websocket/hub';
import type { AgentAdapter } from './adapters/types';
import { DemoAdapter } from './adapters/demo';
import { createHealthRouter } from './routes/health';
import { createAgentsRouter } from './routes/agents';

/** Typed overrides applied on top of env-derived config (used by tests). */
export type AppOverrides = Partial<ServerConfig>;

export interface StartedApp {
  /** Actual bound port (differs from the requested one when `0` is passed). */
  port: number;
  /** Stop adapters, timers, the WS hub and the HTTP server. Idempotent. */
  close: () => Promise<void>;
}

export interface CreatedApp {
  app: express.Application;
  registry: AgentRegistry;
  hub: WsHub;
  config: ServerConfig;
  start: (port?: number) => Promise<StartedApp>;
}

function isJsonSyntaxError(err: unknown): boolean {
  return (
    err instanceof SyntaxError &&
    typeof (err as { status?: unknown }).status === 'number' &&
    (err as { status?: unknown }).status === 400
  );
}

function boundPort(server: http.Server, fallback: number): number {
  const addr = server.address();
  if (addr !== null && typeof addr === 'object') return addr.port;
  return fallback;
}

// --- graceful shutdown -----------------------------------------------------
// Registered once per process; every started app registers its `close`.
let signalsRegistered = false;
const activeClosers = new Set<() => Promise<void>>();

function registerSignalHandlers(): void {
  if (signalsRegistered) return;
  signalsRegistered = true;
  const shutdown = (signal: string): void => {
    console.log(`[server] received ${signal} — shutting down`);
    void Promise.allSettled([...activeClosers].map((close) => close())).then(() => {
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// --- app factory ------------------------------------------------------------

export function createApp(overrides: AppOverrides = {}): CreatedApp {
  const config: ServerConfig = { ...loadConfig(process.env), ...overrides };
  const registry = new AgentRegistry();
  const startedAtMs = Date.now();

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '256kb' }));

  // Malformed JSON bodies → 400, not a crash and not a 500.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (isJsonSyntaxError(err)) {
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }
    next(err);
  });

  const hub = new WsHub({
    getAgents: () => registry.list(),
    isDemoMode: () => config.demoMode,
  });

  app.use('/health', createHealthRouter(registry, hub, config, startedAtMs));
  app.use('/api/agents', createAgentsRouter(registry, hub, config));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Global error handler — 500 JSON, never leaks internals.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[server] unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  const start = (port: number = config.port): Promise<StartedApp> =>
    new Promise((resolve, reject) => {
      const server = http.createServer(app);
      const adapters: AgentAdapter[] = [];

      server.on('upgrade', (req, socket, head) => {
        if (req.url === '/ws') {
          hub.handleUpgrade(req, socket, head);
        } else {
          socket.destroy();
        }
      });
      server.on('error', reject);

      server.listen(port, () => {
        const actualPort = boundPort(server, port);

        // Single fan-out point: registry mutation + WS broadcast.
        const emit = (agentId: string, event: EventPost): void => {
          const { agent, entry } = registry.upsertFromEvent(agentId, event);
          hub.broadcast({ type: 'agent.update', agent });
          if (entry) {
            hub.broadcast({ type: 'agent.event', agentId: agent.id, entry });
          }
        };

        if (config.demoMode) {
          const demo = new DemoAdapter(registry);
          adapters.push(demo);
          demo.start(emit);
        }

        // Sweep at least as often as the offline timeout so detection stays prompt.
        const sweepIntervalMs = Math.min(5000, config.offlineTimeoutMs);
        const sweepTimer = setInterval(() => {
          for (const agent of registry.markOfflineSweep(config.offlineTimeoutMs)) {
            hub.broadcast({ type: 'agent.update', agent });
          }
        }, sweepIntervalMs);
        if (typeof sweepTimer.unref === 'function') sweepTimer.unref();

        let closed = false;
        const close = async (): Promise<void> => {
          if (closed) return;
          closed = true;
          activeClosers.delete(close);
          clearInterval(sweepTimer);
          for (const adapter of adapters) {
            try {
              adapter.stop();
            } catch (err) {
              console.error(`[server] adapter "${adapter.name}" failed to stop:`, err);
            }
          }
          hub.close();
          await new Promise<void>((done) => server.close(() => done()));
        };
        activeClosers.add(close);
        registerSignalHandlers();

        resolve({ port: actualPort, close });
      });
    });

  return { app, registry, hub, config, start };
}

// --- run directly ------------------------------------------------------------

const isMainModule =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;

if (isMainModule) {
  const { config: mainConfig, start: mainStart } = createApp();
  mainStart()
    .then(({ port }) => {
      console.log(`[server] listening on :${port} (demoMode=${mainConfig.demoMode})`);
    })
    .catch((err: unknown) => {
      console.error('[server] failed to start:', err);
      process.exit(1);
    });
}
