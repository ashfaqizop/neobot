/**
 * Bot control seam (masterdoc §11).
 *
 * A thin facade over the connection manager + behavior engine + live state that
 * exposes the operator actions the dashboard (Phase 6) and Discord (Phase 8)
 * both drive. Typed against minimal structural interfaces so it's trivial to
 * test with fakes.
 */
import { childLogger } from '../lib/logger.js';
import type { StateSnapshot } from './state.js';

const log = childLogger('controller');

export interface ConnectionControls {
  restart(): void;
  reconnectNow(): void;
}

export interface EngineControls {
  setManualPause(paused: boolean): void;
  isManuallyPaused(): boolean;
}

export interface StateSource {
  getSnapshot(): StateSnapshot;
}

export interface ControllerSnapshot extends StateSnapshot {
  resource: { rssBytes: number; heapUsedBytes: number };
  paused: boolean;
  safeMode: boolean;
}

export class BotController {
  private safeModeOn = false;

  constructor(
    private readonly connection: ConnectionControls,
    private readonly engine: EngineControls,
    private readonly state: StateSource,
  ) {}

  pause(): void {
    this.engine.setManualPause(true);
  }

  resume(): void {
    this.engine.setManualPause(false);
  }

  restart(): void {
    this.connection.restart();
  }

  reconnect(): void {
    this.connection.reconnectNow();
  }

  /** Manual Safe Mode toggle. Real movement dial-back arrives in Phase 9. */
  setSafeMode(on: boolean): void {
    this.safeModeOn = on;
    log.warn({ safeMode: on }, 'Safe Mode toggled (auto dial-back arrives in Phase 9)');
  }

  isSafeMode(): boolean {
    return this.safeModeOn;
  }

  /** Full snapshot for the dashboard, including resource usage (§8.4). */
  snapshot(): ControllerSnapshot {
    const mem = process.memoryUsage();
    return {
      ...this.state.getSnapshot(),
      resource: { rssBytes: mem.rss, heapUsedBytes: mem.heapUsed },
      paused: this.engine.isManuallyPaused(),
      safeMode: this.safeModeOn,
    };
  }
}
