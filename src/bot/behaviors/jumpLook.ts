/**
 * Idle jumping + look-around (masterdoc §7).
 *
 * Small random glances (yaw/pitch) with occasional jumps — cheap, low-risk
 * activity that keeps the bot "present" without traversing the world.
 */
import type { AFKBehavior } from './types.js';
import { chance, jitter, microPauseMs, randomInt } from './humanize.js';

export const jumpLook: AFKBehavior = {
  name: 'jumpLook',
  enabledByDefault: true,
  weight: 2,
  canRun: (state) => state.position !== null,
  async run(ctx) {
    const { bot, rng, sleep, shouldAbort } = ctx;
    const glances = randomInt(2, 5, rng);
    try {
      for (let i = 0; i < glances && !shouldAbort(); i++) {
        const yaw = rng() * 2 * Math.PI - Math.PI;
        const pitch = jitter(0.4, rng);
        await bot.look(yaw, pitch, false);
        if (shouldAbort()) break;

        if (chance(0.5, rng)) {
          bot.setControlState('jump', true);
          await sleep(randomInt(150, 350, rng));
          bot.setControlState('jump', false);
        }

        await sleep(microPauseMs(rng) + randomInt(200, 900, rng));
      }
    } finally {
      bot.setControlState('jump', false);
    }
  },
};
