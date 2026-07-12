/**
 * Open/close doors (masterdoc §7).
 *
 * Activates a nearby door/gate/trapdoor, then closes it again (net-neutral).
 */
import type { AFKBehavior } from './types.js';
import { randomInt } from './humanize.js';

interface BlockLike {
  name: string;
  position: { x: number; y: number; z: number };
}

const isDoor = (b: BlockLike): boolean => /(_door|_fence_gate|_trapdoor)$/.test(b.name);

export const doors: AFKBehavior = {
  name: 'doors',
  enabledByDefault: true,
  weight: 1,
  canRun: (state) => state.nearby.door,
  async run({ bot, sleep, shouldAbort, rng }) {
    const door = bot.findBlock({ matching: (b) => isDoor(b), maxDistance: 6 });
    if (!door || shouldAbort()) return;

    await bot.activateBlock(door); // open
    await sleep(randomInt(600, 1500, rng));
    if (shouldAbort()) return;

    const still = bot.blockAt(door.position);
    if (still) await bot.activateBlock(still); // close
  },
};
