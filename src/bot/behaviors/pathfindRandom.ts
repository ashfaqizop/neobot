/**
 * Pathfind to a random reachable point (masterdoc §7).
 *
 * Picks a random point within the safe-zone radius of the anchor (or the bot's
 * current position when no anchor is set) and walks there via pathfinder. The
 * engine's player-presence guardian calls `bot.pathfinder.stop()` to abort mid
 * path, which rejects `goto` — handled here.
 */
import pathfinderPkg from 'mineflayer-pathfinder';
import type { AFKBehavior } from './types.js';
import { randomPointInRadius } from './humanize.js';

// mineflayer-pathfinder is CommonJS: named imports fail under native Node ESM,
// so destructure from the default (interop) export.
const { goals } = pathfinderPkg;

/** Cap per-trip roam distance so paths stay short and low-risk. */
const MAX_TRIP_RADIUS = 24;

export const pathfindRandom: AFKBehavior = {
  name: 'pathfindRandom',
  enabledByDefault: true,
  weight: 2,
  canRun: (state) => state.position !== null,
  async run(ctx) {
    const { bot, config } = ctx;
    const pos = bot.entity.position;
    const anchorX = config.safeZone.x ?? pos.x;
    const anchorZ = config.safeZone.z ?? pos.z;
    const radius = Math.min(config.safeZone.radius, MAX_TRIP_RADIUS);

    const { x, z } = randomPointInRadius(anchorX, anchorZ, radius, ctx.rng);
    const goal = new goals.GoalNearXZ(x, z, 2);

    try {
      await bot.pathfinder.goto(goal);
    } catch {
      // Path failed, timed out, or was aborted (player nearby) — pick another
      // point next cycle. Not an error worth surfacing.
    } finally {
      bot.pathfinder.stop();
    }
  },
};
