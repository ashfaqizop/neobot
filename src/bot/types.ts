/**
 * Shared connection-layer types (masterdoc §6, §9, §10).
 *
 * Phase 2 keeps live state in-memory; the shapes here intentionally mirror the
 * Supabase `live_state` / `sessions` tables (masterdoc §9) so Phase 5 can
 * persist them without a redesign.
 */

/** High-level connection status surfaced to the dashboard and `/status.json`. */
export type BotStatus =
  | 'not-configured' // no MC server configured yet (graceful degradation)
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'hibernating-wait' // host asleep / starting (Aternos-style) — poll, don't fail
  | 'banned' // terminal: stop retrying
  | 'fatal'; // terminal: unrecoverable (e.g. unsupported version)

/** Classified reason a disconnect happened (masterdoc §6 table). */
export type DisconnectCategory =
  | 'afk'
  | 'banned'
  | 'whitelist'
  | 'server_restart'
  | 'server_full'
  | 'anticheat'
  | 'hibernating' // host asleep / starting up (Aternos-style)
  | 'network'
  | 'unknown';

/** How aggressively to retry after a given disconnect. */
export type RetryStrategy =
  | 'immediate' // reconnect right away (e.g. AFK-kick)
  | 'backoff' // exponential backoff (default)
  | 'long' // back off to a long interval (e.g. whitelist rejection)
  | 'poll' // steady interval, does NOT count toward max-retries (hibernation)
  | 'none'; // terminal — do not retry (e.g. banned)

/** Result of classifying a disconnect reason string. */
export interface DisconnectClassification {
  category: DisconnectCategory;
  /** Terminal states stop the reconnect loop entirely. */
  terminal: boolean;
  retry: RetryStrategy;
  /** Whether this event should raise an operator alert (Discord in Phase 8). */
  alert: boolean;
}

/** A single connect→disconnect lifecycle (mirrors the `sessions` table). */
export interface SessionRecord {
  connectedAt: string; // ISO 8601, UTC
  disconnectedAt: string | null;
  disconnectReason: string | null;
}

/** One entry in the bounded reconnect history ring. */
export interface ReconnectHistoryEntry {
  at: string; // ISO 8601, UTC
  reason: string;
  category: DisconnectCategory;
}

/**
 * The public payload returned by `GET /status.json` (masterdoc §10).
 * Public and unauthenticated — safe for UptimeRobot and external monitors.
 */
export interface StatusPayload {
  status: BotStatus;
  uptimePercent: number;
  currentActivity: string | null;
  lastUpdated: string; // ISO 8601, UTC
  version: string;
}

/** An operator alert emitted by the connection layer (consumed by Phase 8). */
export interface AlertEvent {
  key: string; // e.g. 'banned', 'reconnect_failed', 'kicked'
  message: string;
  category?: DisconnectCategory;
  meta?: Record<string, unknown>;
}
