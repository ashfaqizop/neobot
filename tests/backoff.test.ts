import { describe, expect, it } from 'vitest';
import { computeBackoff } from '../src/bot/backoff.js';

describe('computeBackoff', () => {
  const opts = { baseMs: 1000, maxMs: 60000 };

  it('attempt 0 returns the base delay (no jitter)', () => {
    expect(computeBackoff(0, opts)).toBe(1000);
  });

  it('grows exponentially', () => {
    expect(computeBackoff(1, opts)).toBe(2000);
    expect(computeBackoff(2, opts)).toBe(4000);
    expect(computeBackoff(3, opts)).toBe(8000);
  });

  it('caps at maxMs', () => {
    expect(computeBackoff(100, opts)).toBe(60000);
  });

  it('never overflows to Infinity for huge attempts', () => {
    expect(Number.isFinite(computeBackoff(1e6, opts))).toBe(true);
    expect(computeBackoff(1e6, opts)).toBe(60000);
  });

  it('adds jitter within [0, jitterMs] using an injectable RNG', () => {
    expect(computeBackoff(0, { ...opts, jitterMs: 500, random: () => 0 })).toBe(1000);
    expect(computeBackoff(0, { ...opts, jitterMs: 500, random: () => 0.999 })).toBe(1500);
  });

  it('floors negative attempts to 0', () => {
    expect(computeBackoff(-5, opts)).toBe(1000);
  });
});
