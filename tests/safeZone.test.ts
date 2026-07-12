import { describe, expect, it } from 'vitest';
import { isWithinSafeZone, resolveAnchor } from '../src/bot/safeZone.js';
import type { SafeZoneConfig } from '../src/bot/behaviors/types.js';

const zone = (over: Partial<SafeZoneConfig> = {}): SafeZoneConfig => ({
  x: 0,
  y: 64,
  z: 0,
  radius: 10,
  ...over,
});

describe('isWithinSafeZone', () => {
  it('allows points inside the radius (horizontal distance)', () => {
    expect(isWithinSafeZone({ x: 6, y: 64, z: 8 }, zone(), false)).toBe(true); // dist 10
    expect(isWithinSafeZone({ x: 3, y: 200, z: 0 }, zone(), false)).toBe(true); // y ignored
  });

  it('rejects points outside the radius', () => {
    expect(isWithinSafeZone({ x: 11, y: 64, z: 0 }, zone(), false)).toBe(false);
  });

  it('boundless overrides all restrictions', () => {
    expect(isWithinSafeZone({ x: 9999, y: 64, z: 9999 }, zone(), true)).toBe(true);
  });

  it('treats an unset anchor as unrestricted', () => {
    expect(isWithinSafeZone({ x: 9999, y: 0, z: 9999 }, zone({ x: null, z: null }), false)).toBe(true);
  });
});

describe('resolveAnchor', () => {
  it('uses configured coordinates when present', () => {
    expect(resolveAnchor(zone({ x: 5, y: 70, z: -5 }), { x: 0, y: 0, z: 0 })).toEqual({ x: 5, y: 70, z: -5 });
  });

  it('falls back to the provided point for unset coordinates', () => {
    expect(resolveAnchor(zone({ x: null, y: null, z: null }), { x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 });
  });
});
