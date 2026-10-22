/**
 * Demo tick — clearly-labeled simulator for the 8 demo agents.
 *
 * Faithful port of the Node `DemoAdapter` tick (`apps/server/src/adapters/demo.ts`):
 * heartbeats for every demo agent (keeps them fresh so the offline sweeper
 * never marks them offline), plus one random plausible event for a random
 * demo agent. Everything produced is labeled `source: 'demo'`.
 *
 * Pure apart from the registry + emit callback, so it stays unit-testable.
 */
import type { AgentInfo, AgentStatus, EventPost } from '@virtual-ai-office/shared';
import type { AgentRegistry } from './registry';

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

export function pick<T>(items: readonly T[], rand: () => number = Math.random): T {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) throw new Error('pick() called with an empty array');
  return item;
}

/**
 * Run one demo tick: heartbeat every demo agent, then one random event for a
 * random demo agent. `emit` receives `(agentId, validated EventPost)` pairs
 * for the caller to apply + broadcast.
 */
export function demoTick(
  registry: AgentRegistry,
  emit: (agentId: string, event: EventPost) => void,
  rand: () => number = Math.random,
): void {
  const agents: AgentInfo[] = registry.list().filter((a) => a.source === 'demo');
  if (agents.length === 0) return;

  for (const agent of agents) {
    emit(agent.id, { type: 'heartbeat' });
  }

  const agent = pick(agents, rand);
  const roll = rand();
  if (roll < 0.3) {
    emit(agent.id, { type: 'status', status: pick(STATUS_POOL, rand) });
  } else if (roll < 0.55) {
    const tasks = TASKS[agent.id] ?? ['Working on the assigned task'];
    emit(agent.id, {
      type: 'task',
      task: pick(tasks, rand),
      progress: rand() < 0.7 ? Math.floor(rand() * 101) : null,
    });
  } else if (roll < 0.8) {
    emit(agent.id, { type: 'event', kind: 'note', message: pick(NOTES, rand) });
  } else {
    emit(agent.id, { type: 'heartbeat' });
  }
}
