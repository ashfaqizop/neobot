/**
 * Safe-zone enforcement (masterdoc §7).
 *
 * Constrains where block-interaction and roaming may happen: within a radius of
 * an anchor point (e.g. spawn). When `boundless` is set, all restrictions are
 * lifted (for private/empty test servers). Pure and unit-tested.
 */
import { distance } from './behaviors/humanize.js';
import type { Point, SafeZoneConfig } from './behaviors/types.js';

/**
 * True if `point` is allowed under the safe-zone rules.
 *
 * - `boundless` → always allowed.
 * - anchor unset (no x/z) → allowed (no zone configured; caller may fall back to
 *   the bot's spawn as the anchor before calling).
 * - otherwise → within `radius` (horizontal XZ distance) of the anchor.
 */
export function isWithinSafeZone(
  point: Point,
  zone: SafeZoneConfig,
  boundless: boolean,
): boolean {
  if (boundless) return true;
  if (zone.x === null || zone.z === null) return true;

  const dx = point.x - zone.x;
  const dz = point.z - zone.z;
  return Math.sqrt(dx * dx + dz * dz) <= zone.radius;
}

/**
 * Resolve the effective anchor: the configured safe-zone center, or a fallback
 * (typically the bot's spawn/current position) when unset.
 */
export function resolveAnchor(zone: SafeZoneConfig, fallback: Point): Point {
  return {
    x: zone.x ?? fallback.x,
    y: zone.y ?? fallback.y,
    z: zone.z ?? fallback.z,
  };
}

// Re-export for callers that want the raw distance helper alongside these.
export { distance };
