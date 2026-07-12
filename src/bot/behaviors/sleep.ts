/**
 * Sleep in a bed (masterdoc §7).
 *
 * At night, if a bed is nearby, pathfinds to it and sleeps briefly. Exported as
 * `sleepInBed` (registered under the name `sleep`) to avoid confusion with the
 * behavior context's `sleep` helper.
 */
import pathfinderPkg from 'mineflayer-pathfinder';
import type { AFKBehavior } from './types.js';

const { goals } = pathfinderPkg;

interface BedBlock {
  position: { x: number; y: number; z: number };
}

export const sleepInBed: AFKBehavior = {
  name: 'sleep',
  enabledByDefault: true,
  weight: 1,
  canRun: (state) => !state.isDay && state.nearby.bed,
  async run({ bot, sleep, shouldAbort }) {
    const bed = bot.findBlock({ matching: (b) => bot.isABed(b), maxDistance: 8 }) as BedBlock | null;
    if (!bed || shouldAbort()) return;

    try {
      await bot.pathfinder.goto(new goals.GoalNear(bed.position.x, bed.position.y, bed.position.z, 2));
      if (shouldAbort()) return;
      await bot.sleep(bed as never);
      await sleep(3000);
    } catch {
      // can't sleep now (daytime, monsters nearby, occupied) — fine
    } finally {
      try {
        await bot.wake();
      } catch {
        // wasn't sleeping
      }
    }
  },
};
