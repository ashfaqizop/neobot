/**
 * Default behavior-engine configuration (masterdoc §7).
 *
 * Phase 3 sources config from the environment + sensible defaults. Phase 5/6
 * will instead load it from Supabase / the setup wizard — the returned
 * `NeoBotConfig` shape is designed so that swap is drop-in.
 */
import type { Env } from '../config/env.js';
import type { NeoBotConfig } from './behaviors/types.js';

/** Fallback chat pool (only used when chat is explicitly enabled). */
const DEFAULT_CHAT_MESSAGES = [
  'brb',
  'just chilling',
  'afk for a bit',
  'gm',
  'nice server',
];

function parseMessages(raw: string | undefined): string[] {
  if (!raw) return DEFAULT_CHAT_MESSAGES;
  const parsed = raw
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
  return parsed.length > 0 ? parsed : DEFAULT_CHAT_MESSAGES;
}

export function buildDefaultConfig(env: Env): NeoBotConfig {
  return {
    behaviors: {
      walk: { enabled: true, weight: 3 },
      jumpLook: { enabled: true, weight: 2 },
      pathfindRandom: { enabled: true, weight: 2 },
      chat: { enabled: env.CHAT_ENABLED, weight: 1 },
    },
    chat: {
      enabled: env.CHAT_ENABLED,
      messages: parseMessages(env.CHAT_MESSAGES),
      minIntervalMs: 45_000,
      maxIntervalMs: 180_000,
    },
    playerPause: {
      radius: env.PLAYER_PROXIMITY_RADIUS,
    },
    safeZone: {
      x: env.SAFE_ZONE_X ?? null,
      y: env.SAFE_ZONE_Y ?? null,
      z: env.SAFE_ZONE_Z ?? null,
      radius: env.SAFE_ZONE_RADIUS,
    },
    cycle: { minMs: 3_000, maxMs: 9_000 },
  };
}
