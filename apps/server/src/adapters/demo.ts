/**
 * DemoAdapter — clearly-labeled simulator for the 8 demo agents.
 *
 * On `start()` it seeds the registry with the demo agents and then, every
 * 3 seconds:
 *   1. emits a `heartbeat` for EVERY demo agent (keeps them fresh so the
 *      offline sweeper never marks demo agents offline), and
 *   2. emits one random plausible event (status change, task update with
 *      progress, or activity note) for a random demo agent.
 *
 * Everything produced here is labeled `source: 'demo'` and the WebSocket
 * snapshot carries `demoMode: true` while this adapter runs, so simulated
 * data can never be mistaken for real agents.
 */
import type { AgentInfo, AgentStatus, EventPost } from '@virtual-ai-office/shared';
import type { AgentRegistry } from '../store';
import type { AgentAdapter } from './types';

const TICK_MS = 3000;

/** Weighted status pool — demo agents stay in benign states. */
const STATUS_POOL: AgentStatus[] = [
  'working', 'working', 'working',
  'idle', 'idle',
  'thinking', 'thinking',
  'waiting',
];

const TASKS: Record<string, string[]> = {
  nika: ['Triaging inbox and calendar', 'Summarizing the morning briefing'],
  research: ['Compiling the competitor analysis', 'Verifying sources for the trend report'],
  coding: ['Refactoring the websocket hub', 'Writing unit tests for the registry'],
  writing: ['Drafting the launch announcement', 'Editing the chapter outline'],
  design: ['Iterating on dashboard mockups', 'Polishing the icon set'],
  data: ['Running the weekly metrics pipeline', 'Building the retention cohort chart'],
  automation: ['Backfilling failed webhook deliveries', 'Rotating API credentials'],
  monitoring: ['Watching fleet health dashboards', 'Triaging overnight alerts'],
};

const NOTES: string[] = [
  'Checkpoint saved — resuming shortly.',
  'Found a cleaner approach, rewriting this part.',
  'Waiting on one dependency before continuing.',
  'Quick sanity check passed, moving on.',
  'Pushed an update for review.',
];

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error('pick() called with an empty array');
  return item;
}

export class DemoAdapter implements AgentAdapter {
  readonly name = 'demo';

  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly registry: AgentRegistry) {}

  start(emit: (agentId: string, event: EventPost) => void): void {
    if (this.timer) return; // already started
    this.registry.seedDemoAgents();
    this.timer = setInterval(() => this.tick(emit), TICK_MS);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private tick(emit: (agentId: string, event: EventPost) => void): void {
    const agents: AgentInfo[] = this.registry.list().filter((a) => a.source === 'demo');
    if (agents.length === 0) return;

    // 1. Heartbeats for everyone keep demo agents fresh.
    for (const agent of agents) {
      emit(agent.id, { type: 'heartbeat' });
    }

    // 2. One random plausible event for a random agent.
    const agent = pick(agents);
    const roll = Math.random();
    if (roll < 0.3) {
      const event: EventPost = { type: 'status', status: pick(STATUS_POOL) };
      emit(agent.id, event);
    } else if (roll < 0.55) {
      const tasks = TASKS[agent.id] ?? ['Working on the assigned task'];
      const event: EventPost = {
        type: 'task',
        task: pick(tasks),
        progress: Math.random() < 0.7 ? Math.floor(Math.random() * 101) : null,
      };
      emit(agent.id, event);
    } else if (roll < 0.8) {
      const event: EventPost = { type: 'event', kind: 'note', message: pick(NOTES) };
      emit(agent.id, event);
    } else {
      const event: EventPost = { type: 'heartbeat' };
      emit(agent.id, event);
    }
  }
}
