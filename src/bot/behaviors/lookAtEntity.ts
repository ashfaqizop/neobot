/**
 * Glance at a nearby entity (masterdoc §7).
 *
 * Looks at the nearest non-player entity (mob). Players trigger the
 * player-presence pause, so this naturally targets mobs.
 */
import type { AFKBehavior } from './types.js';
import { randomInt } from './humanize.js';

interface EntityLike {
  type?: string;
  position: { offset(dx: number, dy: number, dz: number): unknown };
  height?: number;
}

export const lookAtEntity: AFKBehavior = {
  name: 'lookAtEntity',
  enabledByDefault: true,
  weight: 1,
  canRun: (state) => state.nearby.entity,
  async run({ bot, sleep, shouldAbort, rng }) {
    const target = bot.nearestEntity(
      (e) => (e as EntityLike).type !== 'player' && (e as EntityLike).type !== 'object',
    ) as EntityLike | null;
    if (!target || shouldAbort()) return;

    const eyeOffset = target.height ? target.height * 0.9 : 1;
    await bot.lookAt(target.position.offset(0, eyeOffset, 0) as never, false);
    await sleep(randomInt(500, 1500, rng));
  },
};
