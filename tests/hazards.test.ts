import { describe, expect, it } from 'vitest';
import { classifyHazard, isHostileEntity, type HazardSnapshot } from '../src/bot/hazards.js';

const snap = (over: Partial<HazardSnapshot> = {}): HazardSnapshot => ({
  isInLava: false,
  lavaAdjacent: false,
  isInWater: false,
  oxygen: 20,
  hostileNearby: false,
  edgeAhead: false,
  ...over,
});

describe('classifyHazard (masterdoc §6 priority)', () => {
  it('returns null when safe', () => {
    expect(classifyHazard(snap())).toBeNull();
  });

  it('lava outranks everything', () => {
    expect(
      classifyHazard(snap({ isInLava: true, isInWater: true, oxygen: 0, hostileNearby: true, edgeAhead: true })),
    ).toBe('lava');
    expect(classifyHazard(snap({ lavaAdjacent: true }))).toBe('lava');
  });

  it('drowning outranks hostile and fall', () => {
    expect(
      classifyHazard(snap({ isInWater: true, oxygen: 4, hostileNearby: true, edgeAhead: true })),
    ).toBe('drowning');
  });

  it('drowning requires being in water AND low oxygen', () => {
    expect(classifyHazard(snap({ isInWater: true, oxygen: 20 }))).toBeNull();
    expect(classifyHazard(snap({ isInWater: false, oxygen: 0 }))).toBeNull();
  });

  it('hostile outranks fall', () => {
    expect(classifyHazard(snap({ hostileNearby: true, edgeAhead: true }))).toBe('hostile');
  });

  it('fall is the lowest priority', () => {
    expect(classifyHazard(snap({ edgeAhead: true }))).toBe('fall');
  });
});

describe('isHostileEntity', () => {
  it('matches the Hostile mobs kind (case-insensitive)', () => {
    expect(isHostileEntity({ kind: 'Hostile mobs' })).toBe(true);
    expect(isHostileEntity({ kind: 'hostile' })).toBe(true);
  });
  it('rejects passive mobs and players', () => {
    expect(isHostileEntity({ kind: 'Passive mobs' })).toBe(false);
    expect(isHostileEntity({ type: 'player' })).toBe(false);
    expect(isHostileEntity({})).toBe(false);
  });
});
