/**
 * Safe Mode auto-detection (masterdoc §6.3, §12).
 *
 * Counts anti-cheat kicks/flags in a rolling window; once they cross a threshold
 * it auto-enables Safe Mode (dial-back) via an injected `setSafeMode` and raises
 * a `safe_mode` alert. On by default, but toggleable — with `autoDetect` off the
 * operator tunes manually and this becomes a no-op. Injectable clock for tests.
 */
import { childLogger } from '../lib/logger.js';
import type { AlertEvent } from './types.js';

const log = childLogger('safe-mode');

export interface SafeModeManagerOptions {
  /** Anti-cheat events within the window that trip Safe Mode. */
  threshold: number;
  windowMs: number;
  /** Auto-detection master switch (masterdoc §6.3 — toggleable). */
  autoDetect: boolean;
  /** Enable Safe Mode (wired to `BotController.setSafeMode`). */
  setSafeMode: (on: boolean) => void;
  onAlert?: (event: AlertEvent) => void;
  now?: () => number;
}

export class SafeModeManager {
  private hits: number[] = [];
  private readonly now: () => number;

  constructor(private readonly opts: SafeModeManagerOptions) {
    this.now = opts.now ?? Date.now;
  }

  /** Record an anti-cheat kick/flag; may auto-engage Safe Mode. */
  recordAntiCheat(): void {
    if (!this.opts.autoDetect) return;
    const t = this.now();
    this.hits.push(t);
    this.hits = this.hits.filter((h) => t - h <= this.opts.windowMs);

    if (this.hits.length >= this.opts.threshold) {
      this.hits = [];
      log.warn(
        { threshold: this.opts.threshold, windowMs: this.opts.windowMs },
        'Repeated anti-cheat kicks — auto-enabling Safe Mode',
      );
      this.opts.setSafeMode(true);
      this.opts.onAlert?.({
        key: 'safe_mode',
        message: `Safe Mode auto-enabled after ${this.opts.threshold} anti-cheat kicks in ${Math.round(
          this.opts.windowMs / 1000,
        )}s.`,
      });
    }
  }
}
