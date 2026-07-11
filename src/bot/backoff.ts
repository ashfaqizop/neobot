/**
 * Exponential reconnect back-off (masterdoc §6).
 *
 * Pure and deterministic aside from optional jitter, which is injectable so
 * tests can pin it. Jitter is "full jitter" (random in `[0, computed]` added on
 * top of a capped exponential base) to avoid thundering-herd reconnect storms.
 */

export interface BackoffOptions {
  /** Delay for attempt 0, in ms. */
  baseMs: number;
  /** Absolute ceiling, in ms. */
  maxMs: number;
  /** Max random jitter added on top, in ms (0 disables). */
  jitterMs?: number;
  /** Injectable RNG in [0, 1) for deterministic tests. Defaults to Math.random. */
  random?: () => number;
}

/**
 * Compute the reconnect delay (ms) for a zero-indexed attempt number.
 * `attempt` 0 → ~baseMs; grows exponentially, capped at `maxMs` (before jitter).
 */
export function computeBackoff(attempt: number, opts: BackoffOptions): number {
  const { baseMs, maxMs, jitterMs = 0, random = Math.random } = opts;
  const safeAttempt = Math.max(0, Math.floor(attempt));

  // Cap the exponent so 2 ** attempt cannot overflow to Infinity.
  const exponent = Math.min(safeAttempt, 30);
  const exponential = Math.min(baseMs * 2 ** exponent, maxMs);

  const jitter = jitterMs > 0 ? random() * jitterMs : 0;
  return Math.round(exponential + jitter);
}
