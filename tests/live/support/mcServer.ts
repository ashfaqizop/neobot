/**
 * Local Minecraft world for live tests.
 *
 * Spins up a real, offline-mode Minecraft server in-process via flying-squid
 * (a full JS server: chunks, physics, entities) on an ephemeral port, so the
 * real Mineflayer bot can connect, spawn, and move against an actual world.
 *
 * flying-squid ships no type declarations; this helper is the single `any`
 * boundary and is excluded from the strict typecheck/lint (dev-only).
 */
// flying-squid installs a global uncaughtException handler that calls
// process.exit() — fatal inside a test runner. It skips that when it detects a
// test harness via `globalThis.isMocha`; set it BEFORE requiring the module so
// errors surface to vitest instead of killing the process.
(globalThis as unknown as { isMocha: boolean }).isMocha = true;

// @ts-expect-error — flying-squid has no bundled types
import squid from 'flying-squid';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Minecraft version both flying-squid and Mineflayer test against. */
export const LIVE_MC_VERSION = '1.20.2';

export interface TestWorld {
  host: string;
  port: number;
  version: string;
  /** The live flying-squid server instance (for injecting kicks, etc.). */
  server: any;
  /** Kick a connected player by username (drives disconnect-path tests). */
  kick(username: string, reason?: string): void;
  stop(): Promise<void>;
}

/** Start an offline-mode flying-squid world on an ephemeral port. */
export async function startTestWorld(): Promise<TestWorld> {
  const worldFolder = mkdtempSync(join(tmpdir(), 'neobot-world-'));

  const server: any = squid.createMCServer({
    'online-mode': false,
    port: 0,
    version: LIVE_MC_VERSION,
    'max-players': 5,
    'view-distance': 3,
    logging: false,
    gameMode: 0,
    difficulty: 0,
    worldFolder,
    generation: { name: 'diamond_square', options: { worldHeight: 80 } },
    'everybody-op': true,
    kickTimeout: 30_000,
    motd: 'NeoBot live test world',
    plugins: {},
    'player-list-text': { header: 'NeoBot', footer: 'live test' },
    worldCacheSize: 32,
  });

  await server.waitForReady(30_000);
  const port: number = server.listeningPort as number;

  return {
    host: '127.0.0.1',
    port,
    version: LIVE_MC_VERSION,
    server,
    kick(username: string, reason = 'kicked by test') {
      const player = server.players?.find?.(
        (p: { username?: string }) => p.username === username,
      );
      // flying-squid Player exposes kick(reason)
      player?.kick?.(reason);
    },
    async stop() {
      // flying-squid's destroy() force-ends client sockets, which triggers a
      // logout chat-broadcast that writes to the just-closed connections —
      // throwing "Tried to write to a closed connection" both synchronously and
      // as an async unhandled rejection. Those are shutdown artifacts, not real
      // failures; scope a guard around teardown to absorb only that error.
      const isTeardownNoise = (e: unknown): boolean =>
        String((e as { message?: unknown })?.message ?? e).includes('closed connection');
      const swallow = (e: unknown): void => {
        if (!isTeardownNoise(e)) throw e;
      };
      process.on('unhandledRejection', swallow);
      process.on('uncaughtException', swallow);
      try {
        await Promise.resolve(server.destroy()).catch((e: unknown) => {
          if (!isTeardownNoise(e)) throw e;
        });
        // Let the async logout broadcast flush before dropping the guard.
        await new Promise((r) => setTimeout(r, 300));
      } finally {
        process.off('unhandledRejection', swallow);
        process.off('uncaughtException', swallow);
        rmSync(worldFolder, { recursive: true, force: true });
      }
    },
  };
}
