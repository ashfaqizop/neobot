/**
 * Eat when hungry (masterdoc §7).
 *
 * Keeps the bot alive over long sessions. Only eligible when food is low and a
 * food item is in the inventory.
 */
import type { AFKBehavior } from './types.js';

/** Below this food level (out of 20) the bot will eat if it can. */
export const HUNGRY_THRESHOLD = 18;

interface RegistryLike {
  foodsByName: Record<string, unknown>;
}

export const eat: AFKBehavior = {
  name: 'eat',
  enabledByDefault: true,
  weight: 1,
  canRun: (state) => state.food < HUNGRY_THRESHOLD && state.inventory.hasFood,
  async run({ bot, shouldAbort }) {
    if (shouldAbort()) return;
    const foods = (bot.registry as unknown as RegistryLike).foodsByName;
    const foodItem = bot.inventory.items().find((it) => it.name in foods);
    if (!foodItem) return;
    await bot.equip(foodItem, 'hand');
    try {
      await bot.consume();
    } catch {
      // already full / interrupted — fine
    }
  },
};
