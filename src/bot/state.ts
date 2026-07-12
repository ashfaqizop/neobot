/**
 * In-memory live-state store (masterdoc §8.4, §9, §10).
 *
 * Single source of truth for "what is the bot doing right now" during Phase 2.
 * It is an `EventEmitter` so downstream subsystems subscribe without coupling:
 *   - Phase 5 mirrors updates into the Supabase `live_state` table.
 *   - Phase 6 pushes updates to the dashboard over Socket.IO.
 *
 * Timestamps are stored as ISO-8601 UTC strings; the dashboard localizes them.
 */
import { EventEmitter } from 'node:events';
import type {
  BotStatus,
  DisconnectCategory,
  ReconnectHistoryEntry,
  SessionRecord,
  StatusPayload,
} from './types.js';

const APP_VERSION = process.env.npm_package_version ?? '0.1.0';
const MAX_HISTORY = 50;

export interface StateSnapshot {
  status: BotStatus;
  currentActivity: string | null;
  lastDisconnectReason: string | null;
  uptimePercent: number;
  sessions: SessionRecord[];
  reconnectHistory: ReconnectHistoryEntry[];
  startedAt: string;
  lastUpdated: string;
}

export class LiveStateStore extends EventEmitter {
  private status: BotStatus = 'not-configured';
  private currentActivity: string | null = null;
  private lastDisconnectReason: string | null = null;
  private readonly sessions: SessionRecord[] = [];
  private readonly reconnectHistory: ReconnectHistoryEntry[] = [];
  private startedAtMs: number;
  private lastUpdatedMs: number;

  /** Injectable clock for deterministic tests. */
  constructor(private readonly now: () => number = Date.now) {
    super();
    this.startedAtMs = this.now();
    this.lastUpdatedMs = this.now();
  }

  private touch(): void {
    this.lastUpdatedMs = this.now();
    this.emit('update', this.getStatusPayload());
  }

  setStatus(status: BotStatus, activity?: string | null): void {
    this.status = status;
    if (activity !== undefined) this.currentActivity = activity;
    this.touch();
  }

  setActivity(activity: string | null): void {
    this.currentActivity = activity;
    this.touch();
  }

  getStatus(): BotStatus {
    return this.status;
  }

  /** Record the start of a new connected session. */
  recordSessionStart(): void {
    const connectedAt = new Date(this.now()).toISOString();
    this.sessions.push({ connectedAt, disconnectedAt: null, disconnectReason: null });
    // Phase 5: the persistence bridge writes this to the `sessions` table.
    this.emit('session:start', { connectedAt });
    this.touch();
  }

  /** Close the most recent open session with a disconnect reason. */
  recordSessionEnd(reason: string | null): void {
    this.lastDisconnectReason = reason;
    const disconnectedAt = new Date(this.now()).toISOString();
    const open = [...this.sessions].reverse().find((s) => s.disconnectedAt === null);
    if (open) {
      open.disconnectedAt = disconnectedAt;
      open.disconnectReason = reason;
    }
    this.emit('session:end', { disconnectedAt, reason });
    this.touch();
  }

  /**
   * Restore state from a persisted snapshot (masterdoc §9) so status and uptime
   * survive a mid-session container restart. Keeps `startedAt` for continuity.
   */
  hydrate(snapshot: StateSnapshot): void {
    this.status = snapshot.status;
    this.currentActivity = snapshot.currentActivity;
    this.lastDisconnectReason = snapshot.lastDisconnectReason;
    this.sessions.length = 0;
    this.sessions.push(...snapshot.sessions);
    this.reconnectHistory.length = 0;
    this.reconnectHistory.push(...snapshot.reconnectHistory);
    const started = Date.parse(snapshot.startedAt);
    if (!Number.isNaN(started)) this.startedAtMs = started;
    this.lastUpdatedMs = this.now();
    this.emit('update', this.getStatusPayload());
  }

  /** Append a reconnect attempt to the bounded history ring. */
  recordReconnect(reason: string, category: DisconnectCategory): void {
    this.reconnectHistory.push({
      at: new Date(this.now()).toISOString(),
      reason,
      category,
    });
    if (this.reconnectHistory.length > MAX_HISTORY) this.reconnectHistory.shift();
    this.touch();
  }

  /** Percentage of observed wall-clock time the bot has been connected. */
  uptimePercent(): number {
    const nowMs = this.now();
    const observedMs = nowMs - this.startedAtMs;
    if (observedMs <= 0) return 0;

    const connectedMs = this.sessions.reduce((sum, s) => {
      const start = Date.parse(s.connectedAt);
      const end = s.disconnectedAt ? Date.parse(s.disconnectedAt) : nowMs;
      return sum + Math.max(0, end - start);
    }, 0);

    const pct = (connectedMs / observedMs) * 100;
    return Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10;
  }

  /** The public `/status.json` payload (masterdoc §10). */
  getStatusPayload(): StatusPayload {
    return {
      status: this.status,
      uptimePercent: this.uptimePercent(),
      currentActivity: this.currentActivity,
      lastUpdated: new Date(this.lastUpdatedMs).toISOString(),
      version: APP_VERSION,
    };
  }

  /** Fuller snapshot for the dashboard (Phase 6/7) and tests. */
  getSnapshot(): StateSnapshot {
    return {
      status: this.status,
      currentActivity: this.currentActivity,
      lastDisconnectReason: this.lastDisconnectReason,
      uptimePercent: this.uptimePercent(),
      sessions: this.sessions.map((s) => ({ ...s })),
      reconnectHistory: this.reconnectHistory.map((h) => ({ ...h })),
      startedAt: new Date(this.startedAtMs).toISOString(),
      lastUpdated: new Date(this.lastUpdatedMs).toISOString(),
    };
  }
}
