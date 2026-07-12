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

/**
 * Dashboard auth configuration (masterdoc §8.2). Login/password is the always-on
 * baseline (the admin account lives in the `admin_users` table); these two extra
 * layers are independently toggleable. No secrets here — the session secret is
 * env-only.
 */
export interface AuthConfig {
  /** Optional shareable access-token URL. */
  tokenUrl: { enabled: boolean; token: string | null };
  /** Optional "super-security" IP allowlist (off by default). */
  ipAllowlist: { enabled: boolean; entries: string[] };
}

export interface AppConfig {
  connection: ConnectionConfig;
  behavior: NeoBotConfig;
  auth: AuthConfig;
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
    auth: {
      tokenUrl: { enabled: false, token: null },
      ipAllowlist: { enabled: false, entries: [] },
    },
  };
}
