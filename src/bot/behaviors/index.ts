/**
 * Behavior registry + public interface (masterdoc §5, §7).
 *
 * To add a behavior: implement `AFKBehavior` in a new module and register it in
 * `behaviorRegistry` below. Nothing in the engine core needs to change.
 * See `docs/BEHAVIOR_MODULE_GUIDE.md`.
 */
import type { AFKBehavior } from './types.js';
// Phase 3 — core behaviors.
import { walk } from './walk.js';
import { jumpLook } from './jumpLook.js';
import { pathfindRandom } from './pathfindRandom.js';
import { chat } from './chat.js';
// Phase 4 — extended behaviors.
import { sneak } from './sneak.js';
import { swim } from './swim.js';
import { eat } from './eat.js';
import { fish } from './fish.js';
import { sleepInBed } from './sleep.js';
import { doors } from './doors.js';
import { boat } from './boat.js';
import { lookAtEntity } from './lookAtEntity.js';
import { itemDropPickup } from './itemDropPickup.js';
import { mineBlocks } from './mineBlocks.js';

export * from './types.js';

/** All behaviors available to the engine. */
export const behaviorRegistry: AFKBehavior[] = [
  walk,
  jumpLook,
  pathfindRandom,
  chat,
  sneak,
  swim,
  eat,
  fish,
  sleepInBed,
  doors,
  boat,
  lookAtEntity,
  itemDropPickup,
  mineBlocks,
];
