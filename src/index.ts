/**
 * NeoBot entrypoint.
 *
 * Phases 2–5 wired here:
 *   - persistence (Supabase or in-memory) — config bootstrap + live-state restore,
 *   - the live-state store (mirrored to the `live_state`/`sessions` tables),
 *   - the connection manager (connects + reconnects the Mineflayer bot),
 *   - the behavior engine (runs while spawned),
 *   - a minimal HTTP server exposing the public `/status.json` keep-alive target.
 *
 * Later phases add the full dashboard + Socket.IO (P6–7), Discord (P8), and the
 * memory watchdog (P9).
 */
import type { Server } from 'node:http';
import type { Bot } from 'mineflayer';
import { env } from './config/env.js';
import { buildDefaultAppConfig, type ConnectionConfig } from './config/appConfig.js';
import { logger } from './lib/logger.js';
import { LiveStateStore } from './bot/state.js';
import { ConnectionManager, type BotConnectOptions } from './bot/connection.js';
import { BehaviorEngine } from './bot/behaviorEngine.js';
import { BotController } from './bot/controller.js';
import { createApp, startServer } from './server/app.js';
import { attachSocket } from './server/socket.js';
import type { ConfigHolder } from './server/deps.js';
import { createRepositoriesReady } from './db/repositories/index.js';
import { attachStatePersistence } from './db/statePersistence.js';
import type { AppConfig } from './config/appConfig.js';
import { startDiscord } from './discord/index.js';
import type { DiscordAlerter } from './discord/alerts.js';
import { ALERT_KEYS } from './discord/presenters.js';
import { SafeModeManager } from './bot/safeMode.js';
import { MemoryWatchdog } from './watchdog/memoryWatchdog.js';
import { startSelfPing, type SelfPingHandle } from './watchdog/selfPing.js';
import type { AlertEvent } from './bot/types.js';
import type { EventLevel } from './db/types.js';

/** Map persisted connection config to the manager's connect options (or null). */
function connectOptions(conn: ConnectionConfig): BotConnectOptions | null {
  if (!conn.host || !conn.username) return null;
  return {
    host: conn.host,
    port: conn.port,
    username: conn.username,
    version: conn.version ?? undefined,
  };
}

async function main(): Promise<void> {
  logger.info(
    { nodeEnv: env.NODE_ENV, port: env.PORT, version: process.env.npm_package_version ?? '0.1.0' },
    'NeoBot starting (Phase 9 — resource management)',
  );

  // Persistence: Supabase when configured (verified reachable + migrated, with a
  // brief retry for the PostgREST schema-cache race), else in-memory. A
  // configured-but-broken Supabase degrades to in-memory with a loud warning
  // rather than crash-looping the boot (masterdoc "always boots").
  const repos = await createRepositoriesReady();
  await repos.alertSettings.ensureDefaults(ALERT_KEYS);

  // Config: bootstrap from env on first run, then Supabase is source of truth.
  // A mutable holder lets the dashboard (PUT /api/config) update it live.
  const initialConfig = await repos.config.getOrBootstrap(buildDefaultAppConfig(env));
  let currentConfig: AppConfig = initialConfig;
  const configHolder: ConfigHolder = {
    get: () => currentConfig,
    set: (c) => {
      currentConfig = c;
    },
  };

  // Live state: restore the last snapshot so the dashboard survives a restart.
  const state = new LiveStateStore();
  const restored = await repos.liveState.load();
  if (restored) {
    state.hydrate(restored);
    logger.info('Restored live state from persistence');
  }
  attachStatePersistence(state, repos);

  // Discord (Phase 8) is optional; the alerter is wired in after it starts, so
  // this holder lets alert sources reach it once available.
  let discordAlerter: DiscordAlerter | null = null;
  let safeModeManager: SafeModeManager | null = null;

  // Single alert fan-out: structured log + persisted event + Discord push (§11).
  const dispatchAlert = (event: AlertEvent, category = 'connection', level: EventLevel = 'warn'): void => {
    logger[level === 'error' ? 'error' : 'warn']({ alert: event.key, meta: event.meta }, event.message);
    void repos.events
      .append({ level, category, message: event.message, meta: event.meta })
      .catch((err: unknown) => logger.warn({ err }, 'events.append failed'));
    void discordAlerter?.dispatch(event);
  };

  const engine = new BehaviorEngine(state, initialConfig.behavior);
  const connection = new ConnectionManager(state, {
    getConfig: () => connectOptions(currentConfig.connection),
    onBotReady: (bot) => engine.start(bot as unknown as Bot),
    onBotEnd: () => engine.stop(),
    onAlert: (event) => dispatchAlert(event, 'connection'),
    // Repeated anti-cheat kicks auto-engage Safe Mode dial-back (§6.3).
    onAntiCheat: () => safeModeManager?.recordAntiCheat(),
  });
  const controller = new BotController(connection, engine, state);

  // Safe Mode auto-detection (masterdoc §6.3). Config values apply on restart.
  const smc = currentConfig.behavior.safeMode;
  safeModeManager = new SafeModeManager({
    threshold: smc.antiCheatThreshold,
    windowMs: smc.windowMs,
    autoDetect: smc.autoDetect,
    setSafeMode: (on) => controller.setSafeMode(on),
    onAlert: (event) => dispatchAlert(event, 'behavior'),
  });

  const app = createApp({ state, repos, controller, config: configHolder });
  const server: Server = startServer(app, env.PORT);
  attachSocket(server, { state, getConfig: () => currentConfig });

  // Optional Discord subsystem — slash commands + per-event alerts (§11).
  const discord = await startDiscord({ controller, repos, getConfig: () => currentConfig });
  discordAlerter = discord?.alerter ?? null;

  // Memory watchdog — tiered recovery on the 512MB free-tier ceiling (§12).
  const watchdog = new MemoryWatchdog({
    thresholdBytes: env.MEMORY_THRESHOLD_MB * 1024 * 1024,
    checkIntervalMs: env.MEMORY_CHECK_INTERVAL_MS,
    graceMs: env.MEMORY_GRACE_MS,
    restartConnection: () => controller.restart(),
    restartProcess: () => process.exit(1),
    onAlert: (event) => dispatchAlert(event, 'watchdog'),
  }).start();

  // Optional self-ping keep-alive fallback (default OFF; §10).
  let selfPing: SelfPingHandle | null = null;
  if (env.SELF_PING_ENABLED) {
    const url = env.SELF_PING_URL ?? `http://localhost:${env.PORT}/status.json`;
    selfPing = startSelfPing({ url, intervalMs: env.SELF_PING_INTERVAL_MS });
  }

  connection.start();

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down NeoBot');
    watchdog.stop();
    selfPing?.stop();
    engine.stop();
    connection.stop();
    void discord?.stop().catch(() => undefined);
    // Best-effort final persist so the dashboard shows the last known state.
    void repos.liveState.save(state.getSnapshot()).catch(() => undefined);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Resilience: NeoBot is a keep-alive daemon — a stray async error from a
  // dependency must never take the process down. Surface it as a `crash` alert.
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection (kept alive)');
    dispatchAlert(
      { key: 'crash', message: `Unhandled rejection (recovered): ${String(reason)}` },
      'watchdog',
      'error',
    );
  });
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception (kept alive)');
    dispatchAlert(
      { key: 'crash', message: `Uncaught exception (recovered): ${err.message}` },
      'watchdog',
      'error',
    );
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
