/**
 * Behavior registry + public interface (masterdoc §5, §7).
 *
 * To add a behavior: implement `AFKBehavior` in a new module and register it in
 * `behaviorRegistry` below. Nothing in the engine core needs to change.
 * See `docs/BEHAVIOR_MODULE_GUIDE.md`.
 */
import type { AFKBehavior } from './types.js';
import { walk } from './walk.js';
import { jumpLook } from './jumpLook.js';
import { pathfindRandom } from './pathfindRandom.js';
import { chat } from './chat.js';

export * from './types.js';

/** All behaviors available to the engine (Phase 3 subset). */
export const behaviorRegistry: AFKBehavior[] = [walk, jumpLook, pathfindRandom, chat];
