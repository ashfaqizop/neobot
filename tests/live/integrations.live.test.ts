import { afterAll, describe, expect, it } from 'vitest';
import type { Bot } from 'mineflayer';
import { env } from '../../src/config/env.js';
import { LiveStateStore } from '../../src/bot/state.js';
import { BehaviorEngine } from '../../src/bot/behaviorEngine.js';
import { ConnectionManager } from '../../src/bot/connection.js';
import { BotController } from '../../src/bot/controller.js';
import { createRepositories } from '../../src/db/repositories/index.js';
import {
  InMemoryConfigRepository,
  InMemoryLiveStateRepository,
  InMemoryEventsRepository,
  InMemorySessionsRepository,
  InMemoryAdminUsersRepository,
  InMemoryAlertSettingsRepository,
} from '../../src/db/repositories/index.js';
import type { Repositories } from '../../src/db/types.js';
import { startDiscord } from '../../src/discord/index.js';
import { ALERT_KEYS } from '../../src/discord/presenters.js';
import { buildDefaultAppConfig } from '../../src/config/appConfig.js';

/**
 * Real third-party integrations. These are GATED on credentials in a local
 * `.env` (loaded by tests/live/support/loadEnv.ts). With no creds they skip
 * cleanly — the rest of the live suite proves graceful degradation.
 */

const hasDiscord = Boolean(env.DISCORD_BOT_TOKEN && env.DISCORD_GUILD_ID);
const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_KEY);

/** In-memory repos so the Discord test is independent of any Supabase schema. */
function inMemoryRepos(): Repositories {
  return {
    config: new InMemoryConfigRepository(),
    liveState: new InMemoryLiveStateRepository(),
    events: new InMemoryEventsRepository(),
    sessions: new InMemorySessionsRepository(),
    adminUsers: new InMemoryAdminUsersRepository(),
    alertSettings: new InMemoryAlertSettingsRepository(),
  };
}

describe.skipIf(!hasDiscord)('Discord integration (live credentials)', () => {
  it('logs in, registers slash commands, and dispatches an alert', async () => {
    const state = new LiveStateStore();
    const config = buildDefaultAppConfig(env);
    const repos = inMemoryRepos();
    await repos.alertSettings.ensureDefaults(ALERT_KEYS);
    const engine = new BehaviorEngine(state, config.behavior);
    const connection = new ConnectionManager(state, { getConfig: () => null });
    const controller = new BotController(connection, engine, state);

    const handle = await startDiscord({ controller, repos, getConfig: () => config });
    expect(handle, 'startDiscord should return a handle when creds are valid').not.toBeNull();

    try {
      // A real alert push through the live client — must not throw.
      await handle!.alerter.dispatch({
        key: 'connected',
        message: `NeoBot live-test alert @ ${new Date().toISOString()}`,
      });
    } finally {
      await handle!.stop();
    }
  }, 30_000);
});

describe.skipIf(!hasSupabase)('Supabase persistence (live credentials)', () => {
  const marker = `live-test-${Date.now()}`;

  it('round-trips an event (append → recent)', async () => {
    const repos = createRepositories();
    await repos.events.append({
      level: 'info',
      category: 'test',
      message: marker,
    });
    const recent = await repos.events.recent(25);
    expect(recent.some((e) => e.message === marker)).toBe(true);
  }, 20_000);

  it('persists live state across a fresh client (survives restart)', async () => {
    const writer = createRepositories();
    const snapshot = new LiveStateStore().getSnapshot();
    snapshot.currentActivity = marker;
    await writer.liveState.save(snapshot);

    // A brand-new repository set == a fresh process against the same DB.
    const reader = createRepositories();
    const loaded = await reader.liveState.load();
    expect(loaded?.currentActivity).toBe(marker);
  }, 20_000);

  afterAll(() => {
    // Events are append-only test rows; live_state is a single row the running
    // app overwrites continuously — no cleanup needed.
  });
});
