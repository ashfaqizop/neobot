/**
 * Block interaction / "mining" (masterdoc §7).
 *
 * Off by default. Two safe modes plus a `boundless` escape hatch:
 *   - `self-placed-only` — leave-no-trace: place a block, then dig it back
 *     (net-zero). Tracks its own placements so it never breaks natural blocks.
 *   - `radius-any` — may break natural blocks within the safe zone (or anywhere
 *     when `boundless`).
 *
 * `vec3` is a CommonJS module — use the default factory import (see the P3
 * ESM/CJS lesson) rather than a named import.
 */
import vec3Pkg from 'vec3';
import type { AFKBehavior, BehaviorContext } from './types.js';

// `vec3` is CommonJS (`module.exports = factory; factory.Vec3 = class`). Import
// the default then take the class off it — works at typecheck AND native ESM.
const { Vec3 } = vec3Pkg;
import { isWithinSafeZone } from '../safeZone.js';
import {
  isNaturalDiggable,
  isPlaceableBlock,
  parsePositionKey,
  positionKey,
} from '../blockInteraction.js';

/** Positions this behavior placed itself (self-placed-only mode). */
const placed = new Set<string>();

let placeableCache: { version: string; names: Set<string> } | null = null;
function placeableBlockNames(bot: BehaviorContext['bot']): Set<string> {
  const version = bot.version;
  if (placeableCache?.version === version) return placeableCache.names;
  const registry = bot.registry as unknown as { blocksByName?: Record<string, unknown> };
  const names = new Set(Object.keys(registry.blocksByName ?? {}));
  placeableCache = { version, names };
  return names;
}

async function runSelfPlaced(ctx: BehaviorContext): Promise<void> {
  const { bot, config, shouldAbort } = ctx;

  // 1) Dig back a previously placed block if it's still there.
  for (const key of [...placed]) {
    const p = parsePositionKey(key);
    placed.delete(key);
    const block = bot.blockAt(new Vec3(p.x, p.y, p.z));
    if (block && block.name !== 'air' && bot.canDigBlock(block)) {
      await bot.dig(block);
      return;
    }
  }
  if (shouldAbort()) return;

  // 2) Otherwise place a fresh block from inventory (to dig back next time).
  const names = placeableBlockNames(bot);
  const item = bot.inventory.items().find((it) => isPlaceableBlock(it.name, names));
  if (!item || !bot.entity) return;

  const pos = bot.entity.position;
  const ref = bot.blockAt(
    new Vec3(Math.floor(pos.x - Math.sin(bot.entity.yaw)), Math.floor(pos.y) - 1, Math.floor(pos.z - Math.cos(bot.entity.yaw))),
  );
  if (!ref || ref.name === 'air') return;

  const face = new Vec3(0, 1, 0);
  const target = ref.position.plus(face);
  if (!isWithinSafeZone(target, config.safeZone, config.blockInteraction.boundless)) return;

  await bot.equip(item, 'hand');
  try {
    await bot.placeBlock(ref, face);
    placed.add(positionKey(target));
  } catch {
    // spot occupied / unreachable — try again next cycle
  }
}

async function runRadiusAny(ctx: BehaviorContext): Promise<void> {
  const { bot, config, shouldAbort } = ctx;
  const maxDistance = Math.max(4, Math.min(config.safeZone.radius, 16));

  const positions = bot.findBlocks({
    matching: (block) => isNaturalDiggable(block.name),
    maxDistance,
    count: 25,
  });

  for (const v of positions) {
    if (shouldAbort()) return;
    const block = bot.blockAt(v);
    if (
      block &&
      bot.canDigBlock(block) &&
      isWithinSafeZone(block.position, config.safeZone, config.blockInteraction.boundless)
    ) {
      await bot.dig(block);
      return;
    }
  }
}

export const mineBlocks: AFKBehavior = {
  name: 'mineBlocks',
  enabledByDefault: true, // gated by mode; effectively off unless configured
  weight: 1,
  canRun: (_state, config) => config.blockInteraction.mode !== 'off',
  async run(ctx) {
    const mode = ctx.config.blockInteraction.mode;
    if (mode === 'self-placed-only') return runSelfPlaced(ctx);
    if (mode === 'radius-any') return runRadiusAny(ctx);
  },
};

/** Exposed for tests: clear the self-placed tracking set. */
export function __resetPlaced(): void {
  placed.clear();
}
