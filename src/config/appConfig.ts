/**
 * The full persisted application configuration (masterdoc §9).
 *
 * This is what lives in the Supabase `config` table's `data` jsonb column. It
 * bundles the Minecraft connection settings and the behavior-engine config.
 *
 * IMPORTANT: no secrets live here. Supabase URL/key and the Discord token stay
 * env-only (masterdoc §13) — this object is safe to store and to export/import.
 */
import type { Env } from './env.js';
import { buildDefaultConfig } from '../bot/behaviorConfig.js';
import type { NeoBotConfig } from '../bot/behaviors/types.js';

/** Minecraft target-server connection settings (non-secret). */
export interface ConnectionConfig {
  host: string | null;
  port: number;
  /** null = auto-detect protocol version. */
  version: string | null;
  username: string | null;
}

export interface AppConfig {
  connection: ConnectionConfig;
  behavior: NeoBotConfig;
}

/** Build the default config from the environment (first-run bootstrap value). */
export function buildDefaultAppConfig(env: Env): AppConfig {
  return {
    connection: {
      host: env.MC_HOST ?? null,
      port: env.MC_PORT,
      version: env.MC_VERSION ?? null,
      username: env.MC_USERNAME ?? null,
    },
    behavior: buildDefaultConfig(env),
  };
}
