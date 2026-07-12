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
import { createApp, startServer } from './server/app.js';
import { createRepositories } from './db/repositories/index.js';
import { attachStatePersistence } from './db/statePersistence.js';

/** Alert event keys seeded into `alert_settings` (masterdoc §11). */
const ALERT_KEYS = [
  'connected',
  'disconnected',
  'reconnect_failed',
  'kicked',
  'banned',
  'anticheat',
  'whitelist',
  'crash',
  'low_memory',
  'safe_mode',
  'hibernating',
];

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
    'NeoBot starting (Phase 5 — persistence layer)',
  );

  // Persistence: Supabase when configured, else in-memory (zero-cred boot).
  const repos = createRepositories();
  await repos.alertSettings.ensureDefaults(ALERT_KEYS);

  // Config: bootstrap from env on first run, then Supabase is source of truth.
  const appConfig = await repos.config.getOrBootstrap(buildDefaultAppConfig(env));

  // Live state: restore the last snapshot so the dashboard survives a restart.
  const state = new LiveStateStore();
  const restored = await repos.liveState.load();
  if (restored) {
    state.hydrate(restored);
    logger.info('Restored live state from persistence');
  }
  attachStatePersistence(state, repos);

  const engine = new BehaviorEngine(state, appConfig.behavior);
  const connection = new ConnectionManager(state, {
    getConfig: () => connectOptions(appConfig.connection),
    onBotReady: (bot) => engine.start(bot as unknown as Bot),
    onBotEnd: () => engine.stop(),
    onAlert: (event) => {
      logger.warn({ alert: event.key, meta: event.meta }, event.message);
      void repos.events
        .append({ level: 'warn', category: 'connection', message: event.message, meta: event.meta })
        .catch((err: unknown) => logger.warn({ err }, 'events.append failed'));
    },
  });

  const app = createApp({ state });
  const server: Server = startServer(app, env.PORT);

  connection.start();

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down NeoBot');
    engine.stop();
    connection.stop();
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
  // dependency must never take the process down (Phase 9 handles true recovery).
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection (kept alive)');
  });
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception (kept alive)');
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
