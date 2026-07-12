import { vi } from 'vitest';
import { LiveStateStore } from '../../src/bot/state.js';
import { BotController } from '../../src/bot/controller.js';
import { createRepositories } from '../../src/db/repositories/index.js';
import { buildDefaultAppConfig } from '../../src/config/appConfig.js';
import type { AppConfig } from '../../src/config/appConfig.js';
import type { ApiDeps, ConfigHolder } from '../../src/server/deps.js';
import type { Repositories } from '../../src/db/types.js';
import { env } from '../../src/config/env.js';

/** Fake connection/engine controls for the BotController. */
export function fakeControls() {
  return {
    connection: { restart: vi.fn(), reconnectNow: vi.fn() },
    engine: { setManualPause: vi.fn(), isManuallyPaused: vi.fn(() => false) },
  };
}

export interface TestDeps extends ApiDeps {
  repos: Repositories;
  controls: ReturnType<typeof fakeControls>;
}

/** Build a full ApiDeps backed by in-memory repos + a fake-controlled controller. */
export function makeApiDeps(configOverride?: AppConfig): TestDeps {
  const state = new LiveStateStore();
  const repos = createRepositories(); // in-memory (no Supabase env in tests)
  const controls = fakeControls();
  const controller = new BotController(controls.connection, controls.engine, state);

  let current: AppConfig = configOverride ?? buildDefaultAppConfig(env);
  const config: ConfigHolder = {
    get: () => current,
    set: (c) => {
      current = c;
    },
  };

  return { state, repos, controller, config, controls };
}
