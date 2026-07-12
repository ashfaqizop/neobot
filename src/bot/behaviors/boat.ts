/**
 * Ride a boat (masterdoc §7).
 *
 * Mounts the nearest boat, paddles for a few strokes, then dismounts.
 */
import type { AFKBehavior } from './types.js';
import { randomInt } from './humanize.js';

interface EntityLike {
  name?: string;
}

interface VehicleBot {
  mount(entity: unknown): Promise<void>;
  dismount(): Promise<void>;
  moveVehicle(left: number, forward: number): void;
}

export const boat: AFKBehavior = {
  name: 'boat',
  enabledByDefault: true,
  weight: 1,
  canRun: (state) => state.nearby.boat,
  async run({ bot, sleep, shouldAbort, rng }) {
    const boatEntity = bot.nearestEntity((e) => ((e as EntityLike).name ?? '').includes('boat'));
    if (!boatEntity || shouldAbort()) return;

    const vbot = bot as unknown as VehicleBot;
    try {
      await vbot.mount(boatEntity);
      const strokes = randomInt(2, 4, rng);
      for (let i = 0; i < strokes && !shouldAbort(); i++) {
        vbot.moveVehicle(0, 1);
        await sleep(randomInt(400, 900, rng));
      }
    } catch {
      // mount failed — fine
    } finally {
      try {
        await vbot.dismount();
      } catch {
        // not mounted
      }
    }
  },
};
