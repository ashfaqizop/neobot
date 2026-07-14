import { defineConfig } from 'vitest/config';

/**
 * Live end-to-end suite (opt-in: `npm run test:live`).
 *
 * These specs boot a real Minecraft world (flying-squid), the real Mineflayer
 * bot, and the real Express/Socket.IO server — so they need real timers, real
 * network, and generous timeouts. They are deliberately excluded from the
 * default `npm test` / CI run (see vitest.config.ts).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/live/**/*.test.ts'],
    // Load a local .env (if present) before any spec imports the env config, so
    // the gated Discord/Supabase smoke tests see real credentials.
    setupFiles: ['tests/live/support/loadEnv.ts'],
    // A flying-squid world + chunk generation + reconnect backoff can take a
    // while; give each spec room and run them serially to avoid port/world
    // contention.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
    fileParallelism: false,
  },
});
