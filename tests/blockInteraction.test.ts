import { describe, expect, it } from 'vitest';
import {
  isNaturalDiggable,
  isPlaceableBlock,
  parsePositionKey,
  positionKey,
  UNMINEABLE,
} from '../src/bot/blockInteraction.js';

describe('isNaturalDiggable', () => {
  it('allows ordinary natural blocks', () => {
    expect(isNaturalDiggable('stone')).toBe(true);
    expect(isNaturalDiggable('oak_log')).toBe(true);
    expect(isNaturalDiggable('dirt')).toBe(true);
  });

  it('never digs unbreakable / liquid / grief-sensitive blocks', () => {
    for (const name of ['air', 'water', 'lava', 'bedrock', 'barrier', 'spawner']) {
      expect(isNaturalDiggable(name)).toBe(false);
      expect(UNMINEABLE.has(name)).toBe(true);
    }
  });

  it('rejects empty names', () => {
    expect(isNaturalDiggable('')).toBe(false);
  });
});

describe('positionKey', () => {
  it('floors coordinates and round-trips', () => {
    expect(positionKey({ x: 3.7, y: 64.2, z: -2.9 })).toBe('3,64,-3');
    expect(parsePositionKey('3,64,-3')).toEqual({ x: 3, y: 64, z: -3 });
  });
});

describe('isPlaceableBlock', () => {
  it('is true only for item names that name a block', () => {
    const blocks = new Set(['dirt', 'cobblestone', 'oak_planks']);
    expect(isPlaceableBlock('dirt', blocks)).toBe(true);
    expect(isPlaceableBlock('diamond_sword', blocks)).toBe(false);
  });
});
