/**
 * Shared server dependencies passed to routers and Socket.IO.
 */
import type { Repositories } from '../db/types.js';
import type { BotController } from '../bot/controller.js';
import type { LiveStateStore } from '../bot/state.js';
import type { AppConfig } from '../config/appConfig.js';

/** A live, mutable config reference so auth/config changes take effect at once. */
export interface ConfigHolder {
  get(): AppConfig;
  set(config: AppConfig): void;
}

export interface ApiDeps {
  state: LiveStateStore;
  repos: Repositories;
  controller: BotController;
  config: ConfigHolder;
}
