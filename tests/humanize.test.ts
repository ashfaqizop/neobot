import { describe, expect, it } from 'vitest';
import {
  chance,
  distance,
  jitter,
  randomInt,
  randomInterval,
  randomPointInRadius,
  weightedPick,
} from '../src/bot/behaviors/humanize.js';

describe('humanize helpers', () => {
  describe('randomInt', () => {
    it('returns min when rng=0 and max when rng≈1', () => {
      expect(randomInt(1, 5, () => 0)).toBe(1);
      expect(randomInt(1, 5, () => 0.9999)).toBe(5);
    });
    it('stays within bounds across many samples', () => {
      let r = 0;
      const rng = (): number => ((r += 0.137) % 1);
      for (let i = 0; i < 100; i++) {
        const v = randomInt(3, 8, rng);
        expect(v).toBeGreaterThanOrEqual(3);
        expect(v).toBeLessThanOrEqual(8);
      }
    });
  });

  describe('jitter', () => {
    it('is symmetric and bounded by magnitude', () => {
      expect(jitter(10, () => 0.5)).toBeCloseTo(0);
      expect(jitter(10, () => 1)).toBeCloseTo(10);
      expect(jitter(10, () => 0)).toBeCloseTo(-10);
    });
  });

  describe('randomInterval', () => {
    it('stays within [min, max]', () => {
      expect(randomInterval(1000, 2000, () => 0)).toBe(1000);
      expect(randomInterval(1000, 2000, () => 0.9999)).toBe(2000);
    });
  });

  describe('chance', () => {
    it('fires below the probability threshold', () => {
      expect(chance(0.3, () => 0.29)).toBe(true);
      expect(chance(0.3, () => 0.31)).toBe(false);
    });
  });

  describe('randomPointInRadius', () => {
    it('never exceeds the radius from the anchor', () => {
      let r = 0.01;
      const rng = (): number => ((r += 0.211) % 1);
      for (let i = 0; i < 200; i++) {
        const p = randomPointInRadius(100, -50, 20, rng);
        // +1.5 tolerance for integer rounding of x/z.
        expect(distance({ x: p.x, y: 0, z: p.z }, { x: 100, y: 0, z: -50 })).toBeLessThanOrEqual(21.5);
      }
    });
  });

  describe('weightedPick', () => {
    it('returns null for empty or non-positive weights', () => {
      expect(weightedPick([], () => 0.5)).toBeNull();
      expect(weightedPick([{ item: 'a', weight: 0 }], () => 0.5)).toBeNull();
    });
    it('honors weights deterministically', () => {
      const items = [
        { item: 'a', weight: 1 },
        { item: 'b', weight: 3 },
      ];
      // total = 4; roll = rng*4. a wins when roll<1 (rng<0.25), else b.
      expect(weightedPick(items, () => 0.1)).toBe('a');
      expect(weightedPick(items, () => 0.5)).toBe('b');
    });
  });
});
