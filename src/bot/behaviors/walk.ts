/**
 * Randomized organic walking (masterdoc §7).
 *
 * Uses raw control states (not pure pathfinder) with humanized imperfection:
 * small turns, brief forward/strafe bursts, occasional backtracking, varied
 * sprint, and micro-pauses — so movement doesn't read as a machine to
 * pattern-based anti-cheat.
 */
import type { AFKBehavior } from './types.js';
import { chance, jitter, microPauseMs, randomInt, smallTurn } from './humanize.js';

const STRAFES = ['left', 'right'] as const;

export const walk: AFKBehavior = {
  name: 'walk',
  enabledByDefault: true,
  weight: 3,
  canRun: (state) => state.position !== null,
  async run(ctx) {
    const { bot, rng, sleep, shouldAbort } = ctx;
    const bursts = randomInt(2, 4, rng);
    try {
      for (let i = 0; i < bursts && !shouldAbort(); i++) {
        // Turn a little before moving.
        const yaw = bot.entity.yaw + smallTurn(rng);
        await bot.look(yaw, jitter(0.2, rng), false);
        if (shouldAbort()) break;

        // Vary speed and occasionally step backwards instead of forwards.
        bot.setControlState('sprint', chance(0.4, rng));
        const dir = chance(0.15, rng) ? 'back' : 'forward';
        bot.setControlState(dir, true);

        // Occasional simultaneous strafe for a less linear path.
        const strafing = chance(0.25, rng);
        const strafe = STRAFES[randomInt(0, 1, rng)]!;
        if (strafing) bot.setControlState(strafe, true);

        await sleep(randomInt(400, 1200, rng));

        bot.setControlState(dir, false);
        if (strafing) bot.setControlState(strafe, false);
        bot.setControlState('sprint', false);

        // Micro-pause between bursts.
        await sleep(microPauseMs(rng));
      }
    } finally {
      bot.clearControlStates();
    }
  },
};
