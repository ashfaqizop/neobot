/**
 * Swim / stay afloat (masterdoc §7).
 *
 * Only eligible while in water. Bobs with jump+forward so the bot keeps its head
 * above the surface and drifts a little. (Drowning itself is handled by the
 * hazard guardian, which has priority over this.)
 */
import type { AFKBehavior } from './types.js';
import { chance, randomInt } from './humanize.js';

export const swim: AFKBehavior = {
  name: 'swim',
  enabledByDefault: true,
  weight: 2,
  canRun: (state) => state.isInWater,
  async run({ bot, rng, sleep, shouldAbort }) {
    const strokes = randomInt(2, 4, rng);
    try {
      for (let i = 0; i < strokes && !shouldAbort(); i++) {
        bot.setControlState('jump', true); // rise / stay afloat
        if (chance(0.6, rng)) bot.setControlState('forward', true);
        await sleep(randomInt(400, 1000, rng));
        bot.setControlState('forward', false);
        await sleep(randomInt(200, 500, rng));
      }
    } finally {
      bot.clearControlStates();
    }
  },
};
