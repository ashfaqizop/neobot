/**
 * Drop then pick an item back up (masterdoc §7).
 *
 * Net-zero: tosses a single item from a stack of >1 (so nothing is truly lost),
 * then walks to the drop to re-collect it.
 */
import pathfinderPkg from 'mineflayer-pathfinder';
import type { AFKBehavior } from './types.js';

const { goals } = pathfinderPkg;

interface DropEntity {
  name?: string;
  type?: string;
  position: { x: number; y: number; z: number };
}

export const itemDropPickup: AFKBehavior = {
  name: 'itemDropPickup',
  enabledByDefault: true,
  weight: 1,
  canRun: (state) => state.inventory.tossableItemCount > 0,
  async run({ bot, sleep, shouldAbort }) {
    // Only toss from a stack of more than one so we never lose our last item.
    const stack = bot.inventory.items().find((it) => it.count > 1);
    if (!stack || shouldAbort()) return;

    await bot.toss(stack.type, null, 1);
    await sleep(400);
    if (shouldAbort()) return;

    const drop = bot.nearestEntity(
      (e) => (e as DropEntity).name === 'item' || (e as DropEntity).type === 'object',
    ) as DropEntity | null;
    if (!drop) return;
    try {
      await bot.pathfinder.goto(new goals.GoalNear(drop.position.x, drop.position.y, drop.position.z, 1));
    } catch {
      // couldn't reach it — it may despawn; acceptable for a filler behavior
    }
  },
};
