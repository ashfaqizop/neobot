/**
 * Pure world→canvas projection for the 2D minimap (masterdoc §8.4). Kept
 * side-effect-free so the geometry is unit-testable without a canvas.
 *
 * Minecraft X grows east, Z grows south. On the minimap we map +X → right and
 * +Z → down, matching the common top-down convention (north is up).
 */
import type { Point } from '../lib/types.ts';

export interface SafeZone {
  x: number | null;
  z: number | null;
  radius: number;
}

export interface MinimapView {
  /** World coordinate at the canvas center. */
  centerX: number;
  centerZ: number;
  /** Half the world-units span shown across the canvas. */
  halfSpan: number;
}

/** Choose a view that frames the safe-zone (if anchored) and the bot. */
export function computeView(position: Point | null, safeZone?: SafeZone): MinimapView {
  const anchored = safeZone && safeZone.x !== null && safeZone.z !== null;
  const centerX = anchored ? (safeZone.x as number) : (position?.x ?? 0);
  const centerZ = anchored ? (safeZone.z as number) : (position?.z ?? 0);

  let halfSpan = 32;
  if (safeZone && safeZone.radius > 0) halfSpan = safeZone.radius * 1.35;
  if (position) {
    const dist = Math.max(Math.abs(position.x - centerX), Math.abs(position.z - centerZ));
    halfSpan = Math.max(halfSpan, dist * 1.25);
  }
  return { centerX, centerZ, halfSpan: Math.max(halfSpan, 8) };
}

/** Project a world (x,z) to canvas pixels for a square canvas of `size` px. */
export function project(
  x: number,
  z: number,
  view: MinimapView,
  size: number,
): { px: number; py: number } {
  const scale = size / (view.halfSpan * 2);
  const px = size / 2 + (x - view.centerX) * scale;
  const py = size / 2 + (z - view.centerZ) * scale;
  return { px, py };
}
