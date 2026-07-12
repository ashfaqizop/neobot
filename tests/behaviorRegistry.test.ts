import { describe, expect, it } from 'vitest';
import { behaviorRegistry } from '../src/bot/behaviors/index.js';

describe('behavior registry', () => {
  it('contains all v1 behaviors (Phase 3 core + Phase 4 extended)', () => {
    const names = behaviorRegistry.map((b) => b.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'walk',
        'jumpLook',
        'pathfindRandom',
        'chat',
        'sneak',
        'swim',
        'eat',
        'fish',
        'sleep',
        'doors',
        'boat',
        'lookAtEntity',
        'itemDropPickup',
        'mineBlocks',
      ]),
    );
    expect(names).toHaveLength(14);
  });

  it('has unique behavior names', () => {
    const names = behaviorRegistry.map((b) => b.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every behavior satisfies the AFKBehavior interface', () => {
    for (const b of behaviorRegistry) {
      expect(typeof b.name).toBe('string');
      expect(typeof b.enabledByDefault).toBe('boolean');
      expect(typeof b.weight).toBe('number');
      expect(b.weight).toBeGreaterThan(0);
      expect(typeof b.canRun).toBe('function');
      expect(typeof b.run).toBe('function');
    }
  });

  it('keeps chat disabled by default (safe for real servers)', () => {
    const chat = behaviorRegistry.find((b) => b.name === 'chat');
    expect(chat?.enabledByDefault).toBe(false);
  });
});
