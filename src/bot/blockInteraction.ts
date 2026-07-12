/**
 * Block-interaction helpers (masterdoc §7).
 *
 * Pure logic backing the `mineBlocks` behavior's modes, kept separate so the
 * rules are unit-testable without a live world.
 */
import type { Point } from './behaviors/types.js';

/** Blocks that must never be dug (unbreakable, liquids, or grief-sensitive). */
export const UNMINEABLE = new Set<string>([
  'air',
  'cave_air',
  'void_air',
  'water',
  'lava',
  'bedrock',
  'barrier',
  'command_block',
  'end_portal_frame',
  'end_portal',
  'nether_portal',
  'spawner',
]);

/** True for a natural block that `radius-any` mode may break. */
export function isNaturalDiggable(blockName: string): boolean {
  return blockName.length > 0 && !UNMINEABLE.has(blockName);
}

/** Stable string key for a block position (floored). */
export function positionKey(p: Point): string {
  return `${Math.floor(p.x)},${Math.floor(p.y)},${Math.floor(p.z)}`;
}

/** Parse a {@link positionKey} back into a point. */
export function parsePositionKey(key: string): Point {
  const [x, y, z] = key.split(',').map(Number);
  return { x: x ?? 0, y: y ?? 0, z: z ?? 0 };
}

/** True if an inventory item name corresponds to a placeable block. */
export function isPlaceableBlock(itemName: string, blockNames: ReadonlySet<string>): boolean {
  return blockNames.has(itemName);
}
