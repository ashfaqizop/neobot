/**
 * Sneak in bursts (masterdoc §7).
 *
 * Cheap, low-risk crouching activity. Always eligible when the bot has spawned.
 */
import type { AFKBehavior } from './types.js';
import { randomInt } from './humanize.js';

export const sneak: AFKBehavior = {
  name: 'sneak',
  enabledByDefault: true,
  weight: 1,
  canRun: (state) => state.position !== null,
  async run({ bot, rng, sleep, shouldAbort }) {
    const bursts = randomInt(1, 3, rng);
    try {
      for (let i = 0; i < bursts && !shouldAbort(); i++) {
        bot.setControlState('sneak', true);
        await sleep(randomInt(500, 1500, rng));
        bot.setControlState('sneak', false);
        await sleep(randomInt(300, 900, rng));
      }
    } finally {
      bot.setControlState('sneak', false);
    }
  },
};
