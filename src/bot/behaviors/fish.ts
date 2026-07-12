/**
 * Fishing (masterdoc §7).
 *
 * Equips a fishing rod and casts. Eligible only when a rod is held-able and
 * water is nearby. Capped with a timeout so a slow bite doesn't hog the cycle.
 */
import type { AFKBehavior } from './types.js';

const FISH_TIMEOUT_MS = 20_000;

export const fish: AFKBehavior = {
  name: 'fish',
  enabledByDefault: true,
  weight: 1,
  canRun: (state) => state.inventory.hasFishingRod && state.nearby.water,
  async run({ bot, sleep, shouldAbort }) {
    const rod = bot.inventory.items().find((it) => it.name.includes('fishing_rod'));
    if (!rod || shouldAbort()) return;
    await bot.equip(rod, 'hand');
    try {
      // Resolve on either a catch or a timeout, whichever comes first.
      await Promise.race([bot.fish(), sleep(FISH_TIMEOUT_MS)]);
    } catch {
      // interrupted — fine
    }
  },
};
