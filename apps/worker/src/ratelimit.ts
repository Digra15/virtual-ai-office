/**
 * Sliding-window rate limiter (pure — no I/O, unit-testable).
 *
 * Used by the Durable Object to cap `POST /api/agents/:id/events` per client
 * IP (default 60/minute, matching the Node server's express-rate-limit).
 * In-memory per DO instance; a single global DO owns all traffic, so the
 * window is effectively global for the deployment.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  private windowMs: number;
  private maxHits: number;

  constructor(windowMs: number, maxHits: number) {
    this.windowMs = windowMs;
    this.maxHits = maxHits;
  }

  /** Update the window/limit (e.g. from `[vars]`); resets tracked state. */
  configure(windowMs: number, maxHits: number): void {
    if (windowMs !== this.windowMs || maxHits !== this.maxHits) {
      this.windowMs = windowMs;
      this.maxHits = maxHits;
      this.hits.clear();
    }
  }

  /**
   * Record a hit for `key` at `nowMs`. Returns true when the hit is allowed,
   * false when the caller is over the limit.
   */
  take(key: string, nowMs: number = Date.now()): boolean {
    const cutoff = nowMs - this.windowMs;
    let stamps = this.hits.get(key);
    if (!stamps) {
      stamps = [];
      this.hits.set(key, stamps);
    }
    // Drop expired entries (in place, keeps the map small).
    let drop = 0;
    while (drop < stamps.length && (stamps[drop] ?? 0) <= cutoff) drop += 1;
    if (drop > 0) stamps.splice(0, drop);

    if (stamps.length >= this.maxHits) return false;
    stamps.push(nowMs);

    // Opportunistic cleanup of idle keys.
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) {
        if (v.length === 0 || (v[v.length - 1] ?? 0) <= cutoff) this.hits.delete(k);
      }
    }
    return true;
  }
}
