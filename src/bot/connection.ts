/**
 * Connection manager (masterdoc §6).
 *
 * Owns the single Mineflayer bot's lifecycle: connect → stay connected →
 * classify *why* it dropped → reconnect intelligently (or stop). It depends only
 * on the in-memory {@link LiveStateStore} and pure helpers
 * ({@link classifyDisconnectReason}, {@link computeBackoff}), so its decision
 * logic is fully unit-testable with an injected fake bot.
 *
 * Hooks (`onAlert`, `onAntiCheat`) are the seams later phases plug into:
 *   - Phase 8 routes alerts to Discord.
 *   - Phase 9 replaces the anti-cheat hook with real Safe Mode dial-back.
 */
import type { EventEmitter } from 'node:events';
import { createBot } from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';

// CommonJS module — destructure from the default export for native Node ESM.
const { pathfinder } = pathfinderPkg;
import { childLogger } from '../lib/logger.js';
import { env } from '../config/env.js';
import { computeBackoff } from './backoff.js';
import { classifyDisconnectReason } from './kickReasons.js';
import type { LiveStateStore } from './state.js';
import type { AlertEvent, RetryStrategy } from './types.js';

const log = childLogger('connection');

/** Minimal surface of a Mineflayer bot the manager relies on (eases testing). */
export interface BotLike extends EventEmitter {
  quit?: (reason?: string) => void;
  end?: (reason?: string) => void;
}

export interface BotConnectOptions {
  host: string;
  port: number;
  username: string;
  version?: string | undefined;
}

export interface ConnectionManagerOptions {
  /** Injectable bot factory; defaults to the real Mineflayer `createBot`. */
  botFactory?: (opts: BotConnectOptions) => BotLike;
  /**
   * Provides the MC target config, or null when unconfigured. Defaults to
   * reading the environment. Phase 6 swaps this for a Supabase/wizard-backed
   * provider without touching the manager.
   */
  getConfig?: () => BotConnectOptions | null;
  /** Max reconnect attempts before giving up (masterdoc §6). */
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  jitterMs?: number;
  /** Delay for `immediate` retries (e.g. AFK-kick). */
  immediateRetryMs?: number;
  /** Delay for `long` retries (e.g. whitelist rejection). */
  longRetryMs?: number;
  /** Steady poll interval while the host is hibernating/starting (masterdoc §12). */
  hibernationPollMs?: number;
  /** Operator alert sink (Phase 8 Discord). Defaults to a structured warn log. */
  onAlert?: (event: AlertEvent) => void;
  /** Anti-cheat dial-back hook (Phase 9 Safe Mode). Defaults to a log. */
  onAntiCheat?: () => void;
  /** Called with the live bot once it spawns (Phase 3 behavior engine start). */
  onBotReady?: (bot: BotLike) => void;
  /** Called when the bot disconnects (behavior engine stop). */
  onBotEnd?: () => void;
}

/** Default config provider: reads the environment (masterdoc §6). */
const defaultGetConfig = (): BotConnectOptions | null => {
  if (!env.MC_HOST || !env.MC_USERNAME) return null;
  return {
    host: env.MC_HOST,
    port: env.MC_PORT,
    username: env.MC_USERNAME,
    version: env.MC_VERSION,
  };
};

const defaultBotFactory = (opts: BotConnectOptions): BotLike => {
  const bot = createBot({
    host: opts.host,
    port: opts.port,
    username: opts.username,
    auth: 'offline',
    ...(opts.version ? { version: opts.version } : {}),
  });
  // Load pathfinder so movement behaviors (Phase 3) can navigate.
  bot.loadPlugin(pathfinder);
  return bot;
};

/** Flatten a kick reason (ChatMessage | string | object) to plain text. */
function flattenReason(reason: unknown): string {
  if (reason == null) return '';
  if (typeof reason === 'string') return reason;
  if (typeof reason === 'object') {
    const toStr = (reason as { toString?: unknown }).toString;
    if (typeof toStr === 'function' && toStr !== Object.prototype.toString) {
      // ChatMessage (and similar) implement a meaningful toString().
      return (reason as { toString(): string }).toString();
    }
    try {
      return JSON.stringify(reason);
    } catch {
      return '[unstringifiable reason]';
    }
  }
  // Primitive (number/boolean/bigint/symbol) or function.
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(reason);
}

export class ConnectionManager {
  private readonly botFactory: (opts: BotConnectOptions) => BotLike;
  private readonly getConfig: () => BotConnectOptions | null;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly jitterMs: number;
  private readonly immediateRetryMs: number;
  private readonly longRetryMs: number;
  private readonly onAlert: (event: AlertEvent) => void;
  private readonly onAntiCheat: () => void;
  private readonly onBotReady: (bot: BotLike) => void;
  private readonly onBotEnd: () => void;

  private readonly hibernationPollMs: number;

  private bot: BotLike | null = null;
  private attempt = 0;
  private connected = false;
  private stopped = false;
  private hibernating = false;
  private pendingKickReason: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly state: LiveStateStore,
    opts: ConnectionManagerOptions = {},
  ) {
    this.botFactory = opts.botFactory ?? defaultBotFactory;
    this.getConfig = opts.getConfig ?? defaultGetConfig;
    this.maxRetries = opts.maxRetries ?? 10;
    this.baseBackoffMs = opts.baseBackoffMs ?? 2_000;
    this.maxBackoffMs = opts.maxBackoffMs ?? 60_000;
    this.jitterMs = opts.jitterMs ?? 1_000;
    this.immediateRetryMs = opts.immediateRetryMs ?? 1_500;
    this.longRetryMs = opts.longRetryMs ?? 30 * 60 * 1_000;
    this.hibernationPollMs = opts.hibernationPollMs ?? 30_000;
    this.onAlert =
      opts.onAlert ?? ((e) => log.warn({ alert: e.key, meta: e.meta }, e.message));
    this.onAntiCheat =
      opts.onAntiCheat ??
      (() => log.warn('Anti-cheat kick detected — Safe Mode dial-back arrives in Phase 9'));
    this.onBotReady = opts.onBotReady ?? (() => undefined);
    this.onBotEnd = opts.onBotEnd ?? (() => undefined);
  }

  /** Begin connecting. Safe to call once at startup. */
  start(): void {
    this.stopped = false;
    this.attempt = 0;
    const config = this.getConfig();
    if (!config) {
      log.warn(
        'No MC_HOST/MC_USERNAME configured — bot idle. Dashboard & /status.json still serve (keep-alive works). Configure via the setup wizard or .env.',
      );
      this.state.setStatus('not-configured', null);
      return;
    }
    this.connect(config);
  }

  private connect(config: BotConnectOptions): void {
    if (this.stopped) return;
    this.state.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');
    log.info(
      { host: config.host, port: config.port, version: config.version ?? 'auto', attempt: this.attempt },
      'Connecting to Minecraft server',
    );

    let bot: BotLike;
    try {
      bot = this.botFactory(config);
    } catch (err) {
      // e.g. unsupported protocol version — fail fast, do not loop (§6).
      log.error({ err }, 'Failed to create bot — unrecoverable (check MC_VERSION)');
      this.state.setStatus('fatal', null);
      this.onAlert({ key: 'fatal', message: `Bot creation failed: ${String(err)}` });
      return;
    }

    this.bot = bot;
    this.pendingKickReason = null;

    const onConnected = (): void => this.handleConnected();
    bot.on('login', onConnected);
    bot.on('spawn', onConnected);
    bot.on('kicked', (reason: unknown) => {
      this.pendingKickReason = flattenReason(reason);
      log.warn({ reason: this.pendingKickReason }, 'Kicked from server');
    });
    bot.on('error', (err: unknown) => {
      log.warn({ err }, 'Bot error');
    });
    bot.on('end', (reason: unknown) => {
      this.handleEnd(flattenReason(reason), config);
    });
  }

  private handleConnected(): void {
    if (this.connected) return; // 'login' + 'spawn' can both fire
    this.connected = true;
    this.attempt = 0;
    this.hibernating = false; // the host is up — leave any hibernation wait
    this.state.recordSessionStart();
    this.state.setStatus('connected', 'idle');
    log.info('Connected to Minecraft server');
    // Alert source for the 'connected' event (Discord push, masterdoc §11).
    this.onAlert({ key: 'connected', message: 'Connected to the Minecraft server.' });
    if (this.bot) this.onBotReady(this.bot);
  }

  private handleEnd(endReason: string, config: BotConnectOptions): void {
    const reason = this.pendingKickReason ?? (endReason || 'unknown');
    this.pendingKickReason = null;
    this.teardownBot();

    if (this.connected) {
      this.connected = false;
      this.state.recordSessionEnd(reason);
      this.onBotEnd();
    }

    if (this.stopped) return;

    const classification = classifyDisconnectReason(reason);
    log.info({ reason, ...classification }, 'Disconnected — classified reason');

    // Hibernating/starting host (Aternos-style, masterdoc §12): poll on a steady
    // interval, DON'T count it against max-retries, and alert only on entering
    // the wait (not every poll).
    if (classification.retry === 'poll') {
      if (!this.hibernating) {
        this.hibernating = true;
        this.onAlert({
          key: 'hibernating',
          message: `Host appears to be starting or asleep — polling until it's up: ${reason}`,
          category: 'hibernating',
        });
      }
      this.state.setStatus('hibernating-wait', null);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect(config);
      }, this.hibernationPollMs);
      return;
    }

    // Any non-hibernation disconnect clears the wait state.
    this.hibernating = false;

    if (classification.alert) {
      this.onAlert({
        key: classification.category,
        message: `Disconnected (${classification.category}): ${reason}`,
        category: classification.category,
      });
    }

    // Terminal (e.g. banned): stop cold.
    if (classification.terminal || classification.retry === 'none') {
      this.state.setStatus('banned', null);
      log.error({ reason }, 'Terminal disconnect — halting reconnect loop');
      return;
    }

    if (classification.category === 'anticheat') this.onAntiCheat();

    this.attempt += 1;
    if (this.attempt > this.maxRetries) {
      this.state.setStatus('disconnected', null);
      log.error({ attempts: this.attempt - 1 }, 'Exceeded max reconnect attempts — giving up');
      this.onAlert({
        key: 'reconnect_failed',
        message: `Gave up after ${this.maxRetries} reconnect attempts (last reason: ${reason})`,
      });
      return;
    }

    const delay = this.retryDelay(classification.retry);
    this.state.setStatus('reconnecting', null);
    this.state.recordReconnect(reason, classification.category);
    log.info({ delayMs: delay, attempt: this.attempt }, 'Scheduling reconnect');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(config);
    }, delay);
  }

  private retryDelay(strategy: RetryStrategy): number {
    switch (strategy) {
      case 'immediate':
        return this.immediateRetryMs;
      case 'long':
        return this.longRetryMs;
      case 'poll':
        return this.hibernationPollMs;
      case 'none':
        return 0;
      case 'backoff':
      default:
        return computeBackoff(this.attempt, {
          baseMs: this.baseBackoffMs,
          maxMs: this.maxBackoffMs,
          jitterMs: this.jitterMs,
        });
    }
  }

  private teardownBot(): void {
    const old = this.bot;
    if (old) {
      old.removeAllListeners();
      // mineflayer's auto-version ping can emit a late 'error' on a discarded
      // bot AFTER we detach. An 'error' with no listener throws and would crash
      // the whole keep-alive process — absorb it with a permanent no-op.
      old.on('error', () => {
        /* swallow late errors from the discarded bot */
      });
      this.bot = null;
    }
  }

  /** Stop the manager, cancel any pending reconnect, and quit the bot. */
  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.bot) {
      try {
        this.bot.quit?.('shutting down');
      } catch {
        // ignore quit errors during shutdown
      }
      this.teardownBot();
    }
    if (this.connected) this.onBotEnd();
    this.connected = false;
    this.state.setStatus('disconnected', null);
    log.info('Connection manager stopped');
  }

  /** Restart the connection subsystem (dashboard/Discord control, §11). */
  restart(): void {
    log.info('Restarting connection subsystem');
    this.stop();
    this.start();
  }

  /** Force an immediate reconnect attempt, cancelling any pending backoff (§11). */
  reconnectNow(): void {
    log.info('Forcing immediate reconnect');
    this.restart();
  }
}
