import { describe, expect, it } from 'vitest';
import { SlidingWindowLimiter } from '../ratelimit';

describe('SlidingWindowLimiter', () => {
  it('allows up to the limit within the window', () => {
    const limiter = new SlidingWindowLimiter(60_000, 3);
    expect(limiter.take('ip', 0)).toBe(true);
    expect(limiter.take('ip', 1_000)).toBe(true);
    expect(limiter.take('ip', 2_000)).toBe(true);
    expect(limiter.take('ip', 3_000)).toBe(false);
  });

  it('slides the window: old hits expire', () => {
    const limiter = new SlidingWindowLimiter(60_000, 2);
    expect(limiter.take('ip', 0)).toBe(true);
    expect(limiter.take('ip', 1_000)).toBe(true);
    expect(limiter.take('ip', 2_000)).toBe(false);
    // After 61s the first hit has expired.
    expect(limiter.take('ip', 61_000)).toBe(true);
  });

  it('tracks keys independently', () => {
    const limiter = new SlidingWindowLimiter(60_000, 1);
    expect(limiter.take('a', 0)).toBe(true);
    expect(limiter.take('a', 1)).toBe(false);
    expect(limiter.take('b', 1)).toBe(true);
  });

  it('configure() updates the limit and resets state', () => {
    const limiter = new SlidingWindowLimiter(60_000, 1);
    expect(limiter.take('ip', 0)).toBe(true);
    expect(limiter.take('ip', 1)).toBe(false);
    limiter.configure(60_000, 5);
    expect(limiter.take('ip', 2)).toBe(true);
    expect(limiter.take('ip', 3)).toBe(true);
  });
});
