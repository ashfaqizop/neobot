/**
 * NeoBot entrypoint.
 *
 * Phase 1 (scaffolding) provides a minimal, valid bootstrap so the toolchain,
 * tests, and container image have something real to run. Subsequent phases wire
 * in the actual subsystems here:
 *   - Phase 2: connection manager + `/status.json` health endpoint
 *   - Phase 6: Express dashboard server + Socket.IO
 *   - Phase 8: optional Discord bot
 *   - Phase 9: memory watchdog
 */
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

function main(): void {
  logger.info(
    { nodeEnv: env.NODE_ENV, port: env.PORT, version: process.env.npm_package_version },
    'NeoBot starting (Phase 1 scaffold — no subsystems wired yet)',
  );

  // Keep the process alive so container/host process managers treat it as a
  // long-running service. Real subsystems replace this in later phases.
  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'Shutting down NeoBot');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('NeoBot is idle and awaiting subsystem wiring. Press Ctrl+C to exit.');
}

main();
