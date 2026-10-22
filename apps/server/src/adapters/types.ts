/**
 * Agent adapter seam.
 *
 * An `AgentAdapter` is the single integration point between the outside world
 * and the Virtual AI Office backend. Adapters observe real systems and report
 * what they see by calling `emit(agentId, event)` with validated `EventPost`
 * payloads — the same shape real agents POST to `/api/agents/:id/events`.
 *
 * Monitoring only: adapters MUST NOT execute commands, mutate remote systems,
 * or assume any particular agent framework. They report; they never act.
 *
 * Future adapters (e.g. a Hermes Agent adapter) implement this interface and
 * are wired in `src/index.ts` next to the `DemoAdapter`. No endpoint or
 * protocol is assumed here — a Hermes adapter would translate whatever its
 * source provides into `EventPost`s.
 */
import type { EventPost } from '@virtual-ai-office/shared';

export interface AgentAdapter {
  /** Human-readable adapter name, used in logs. */
  readonly name: string;

  /**
   * Start producing events. `emit` applies the event to the registry and
   * broadcasts it to WebSocket clients. May be called at most once; the
   * adapter owns any timers/sockets it creates until `stop()`.
   */
  start(emit: (agentId: string, event: EventPost) => void): void;

  /** Stop producing events and release timers/sockets. Idempotent. */
  stop(): void;
}
