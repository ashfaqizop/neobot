/**
 * NeoBot entrypoint.
 *
 * Phase 2 wires the deployable keep-alive MVP:
 *   - a live-state store (in-memory; Supabase-backed in Phase 5),
 *   - the connection manager (connects + reconnects the Mineflayer bot),
 *   - a minimal HTTP server exposing the public `/status.json` keep-alive target.
 *
 * Later phases add the behavior engine (P3–4), persistence (P5), the full
 * dashboard + Socket.IO (P6–7), Discord (P8), and the watchdog (P9).
 */
import type { Server } from 'node:http';
import type { Bot } from 'mineflayer';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { LiveStateStore } from './bot/state.js';
import { ConnectionManager } from './bot/connection.js';
import { BehaviorEngine } from './bot/behaviorEngine.js';
import { buildDefaultConfig } from './bot/behaviorConfig.js';
import { createApp, startServer } from './server/app.js';

function main(): void {
  logger.info(
    { nodeEnv: env.NODE_ENV, port: env.PORT, version: process.env.npm_package_version ?? '0.1.0' },
    'NeoBot starting (Phase 3 — behavior engine)',
  );

  const state = new LiveStateStore();
  const behaviorConfig = buildDefaultConfig(env);
  const engine = new BehaviorEngine(state, behaviorConfig);
  const connection = new ConnectionManager(state, {
    // Run the anti-AFK behavior engine only while the bot is spawned.
    onBotReady: (bot) => engine.start(bot as unknown as Bot),
    onBotEnd: () => engine.stop(),
  });
  const app = createApp({ state });
  const server: Server = startServer(app, env.PORT);

  // Start connecting (or idle gracefully if no MC server is configured yet).
  connection.start();

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down NeoBot');
    engine.stop();
    connection.stop();
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    // Safety net if the server refuses to close in time.
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Resilience: NeoBot is a keep-alive daemon — a stray async error from a
  // dependency (e.g. a late socket error) must never take the process down.
  // Log and keep serving; the memory watchdog (Phase 9) handles true recovery.
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection (kept alive)');
  });
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception (kept alive)');
  });
}

main();
