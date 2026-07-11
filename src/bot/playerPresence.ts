/**
 * Player-presence detection (masterdoc §7).
 *
 * The always-on safety default: when a real player comes within a configured
 * radius, all simulated activity pauses. These pure helpers back that guardian
 * and are unit-tested independently of a live bot.
 */
import { distance } from './behaviors/humanize.js';
import type { BotState, PlayerInfo } from './behaviors/types.js';

/**
 * Players (excluding the bot itself) within `radius` blocks of the bot.
 * Returns an empty list if the bot's own position is unknown.
 */
export function findNearbyPlayers(state: BotState, radius: number): PlayerInfo[] {
  const self = state.position;
  if (!self) return [];
  return state.players.filter(
    (p) => p.username !== state.self && p.position !== null && distance(p.position, self) <= radius,
  );
}

/** True when at least one real player is within `radius` of the bot. */
export function isPlayerNearby(state: BotState, radius: number): boolean {
  return findNearbyPlayers(state, radius).length > 0;
}
