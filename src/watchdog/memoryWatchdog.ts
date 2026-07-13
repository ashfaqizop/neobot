/**
 * Memory watchdog with tiered recovery (masterdoc §12).
 *
 * Free hosts cap at ~512 MB. This polls process RSS against a threshold and, on
 * crossing it, recovers in tiers:
 *   - **Tier 1 (cheap):** restart the Mineflayer connection subsystem alone
 *     (+ a GC nudge when `--expose-gc`), then wait a grace period.
 *   - **Tier 2 (last resort):** if memory hasn't recovered, exit the process so
 *     the host's manager (Render) restarts it fresh.
 *
 * Everything external is injected (memory reader, clock, both recovery actions,
 * alert sink), so the tier logic is fully unit-testable without real OOM.
 */
import { childLogger } from '../lib/logger.js';
import type { AlertEvent } from '../bot/types.js';

const log = childLogger('memory-watchdog');

export interface MemoryWatchdogOptions {
  thresholdBytes: number;
  checkIntervalMs: number;
  /** Grace period after a tier-1 restart before escalating to tier 2. */
  graceMs: number;
  /** Restart the connection subsystem (cheap recovery) — `controller.restart()`. */
  restartConnection: () => void;
  /** Restart the whole process (last resort) — `process.exit(1)`. */
  restartProcess: () => void;
  onAlert?: (event: AlertEvent) => void;
  /** RSS reader; defaults to `process.memoryUsage().rss`. */
  readMemory?: () => number;
  now?: () => number;
}

type Phase = 'ok' | 'grace';

export class MemoryWatchdog {
  private timer: ReturnType<typeof setInterval> | null = null;
  private phase: Phase = 'ok';
  private graceStart = 0;
  private readonly readMemory: () => number;
  private readonly now: () => number;

  constructor(private readonly opts: MemoryWatchdogOptions) {
    this.readMemory = opts.readMemory ?? (() => process.memoryUsage().rss);
    this.now = opts.now ?? Date.now;
  }

  start(): this {
    if (this.timer) return this;
    log.info(
      { thresholdMB: Math.round(this.opts.thresholdBytes / 1024 / 1024) },
      'Memory watchdog started',
    );
    this.timer = setInterval(() => this.check(), this.opts.checkIntervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
    return this;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** One evaluation tick. Exposed for deterministic tests. */
  check(): void {
    const rss = this.readMemory();
    const over = rss > this.opts.thresholdBytes;

    if (this.phase === 'ok') {
      if (over) this.enterTier1(rss);
      return;
    }

    // phase === 'grace': waiting to see if tier-1 recovered memory.
    if (!over) {
      log.info({ rss }, 'Memory recovered after connection restart');
      this.phase = 'ok';
      return;
    }
    if (this.now() - this.graceStart >= this.opts.graceMs) this.enterTier2(rss);
  }

  private enterTier1(rss: number): void {
    const mb = Math.round(rss / 1024 / 1024);
    log.warn({ rssMB: mb }, 'Memory over threshold — tier 1: restarting connection subsystem');
    this.opts.onAlert?.({
      key: 'low_memory',
      message: `Memory high (${mb} MB) — restarting the connection to recover.`,
    });
    try {
      (globalThis as { gc?: () => void }).gc?.();
      this.opts.restartConnection();
    } catch (err) {
      log.warn({ err }, 'Tier-1 recovery action threw');
    }
    this.phase = 'grace';
    this.graceStart = this.now();
  }

  private enterTier2(rss: number): void {
    const mb = Math.round(rss / 1024 / 1024);
    log.error({ rssMB: mb }, 'Memory still high after grace — tier 2: restarting process');
    this.opts.onAlert?.({
      key: 'low_memory',
      message: `Memory still high (${mb} MB) after restart — restarting the process.`,
    });
    this.phase = 'ok';
    this.opts.restartProcess();
  }
}
