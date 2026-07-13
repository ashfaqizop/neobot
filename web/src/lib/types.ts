/**
 * Frontend mirror of the Phase 6 backend contract. Kept in lockstep with
 * `src/bot/types.ts`, `src/bot/state.ts`, `src/bot/controller.ts`,
 * `src/config/appConfig.ts`, and `src/db/types.ts`. These are the shapes the
 * dashboard reads from `/api/*` and the Socket.IO `state` event.
 */

export type BotStatus =
  | 'not-configured'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'banned'
  | 'fatal';

export type DisconnectCategory =
  | 'afk'
  | 'banned'
  | 'whitelist'
  | 'server_restart'
  | 'server_full'
  | 'anticheat'
  | 'network'
  | 'unknown';

export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface SessionRecord {
  connectedAt: string;
  disconnectedAt: string | null;
  disconnectReason: string | null;
}

export interface ReconnectHistoryEntry {
  at: string;
  reason: string;
  category: DisconnectCategory;
}

/** Public `/status.json` + Socket.IO `state` event payload. */
export interface StatusPayload {
  status: BotStatus;
  uptimePercent: number;
  currentActivity: string | null;
  lastUpdated: string;
  version: string;
}

/** `GET /api/state` (BotController.snapshot) — the dashboard's core model. */
export interface ControllerSnapshot {
  status: BotStatus;
  currentActivity: string | null;
  lastDisconnectReason: string | null;
  uptimePercent: number;
  sessions: SessionRecord[];
  reconnectHistory: ReconnectHistoryEntry[];
  position: Point | null;
  playerCount: number;
  startedAt: string;
  lastUpdated: string;
  resource: { rssBytes: number; heapUsedBytes: number };
  paused: boolean;
  safeMode: boolean;
}

// ---- Config (`GET/PUT /api/config`) --------------------------------------

export interface BehaviorSetting {
  enabled: boolean;
  weight: number;
}

export interface NeoBotConfig {
  behaviors: Record<string, BehaviorSetting>;
  chat: { enabled: boolean; messages: string[]; minIntervalMs: number; maxIntervalMs: number };
  playerPause: { radius: number };
  safeZone: { x: number | null; y: number | null; z: number | null; radius: number };
  blockInteraction: { mode: 'off' | 'self-placed-only' | 'radius-any'; boundless: boolean };
  hazards: { enabled: boolean };
  cycle: { minMs: number; maxMs: number };
}

export interface AppConfig {
  connection: { host: string | null; port: number; version: string | null; username: string | null };
  behavior: NeoBotConfig;
  auth: {
    tokenUrl: { enabled: boolean; token: string | null };
    ipAllowlist: { enabled: boolean; entries: string[] };
  };
}

// ---- Logs / sessions (`GET /api/logs`, `GET /api/sessions`) ---------------

export type EventLevel = 'info' | 'warn' | 'error';

export interface EventRecord {
  id: number;
  createdAt: string;
  level: EventLevel;
  category: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface SessionRow {
  id: number;
  connectedAt: string;
  disconnectedAt: string | null;
  disconnectReason: string | null;
}

// ---- Setup / auth ---------------------------------------------------------

export interface SetupStatus {
  needsSetup: boolean;
  supabaseConfigured: boolean;
  discordConfigured: boolean;
}

export interface AuthUser {
  username: string;
}
