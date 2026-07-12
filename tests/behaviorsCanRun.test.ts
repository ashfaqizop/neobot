import { describe, expect, it } from 'vitest';
import { behaviorRegistry } from '../src/bot/behaviors/index.js';
import type { AFKBehavior, BotState, NeoBotConfig } from '../src/bot/behaviors/types.js';

function get(name: string): AFKBehavior {
  const b = behaviorRegistry.find((x) => x.name === name);
  if (!b) throw new Error(`no behavior named ${name}`);
  return b;
}

function state(over: Partial<BotState> = {}): BotState {
  return {
    self: 'NeoBot',
    position: { x: 0, y: 64, z: 0 },
    health: 20,
    food: 20,
    oxygen: 20,
    onGround: true,
    isInWater: false,
    isInLava: false,
    isDay: true,
    inventory: { hasFood: false, hasFishingRod: false, tossableItemCount: 0 },
    nearby: { water: false, bed: false, door: false, boat: false, entity: false },
    players: [],
    ...over,
  };
}

function config(over: Partial<NeoBotConfig> = {}): NeoBotConfig {
  return {
    behaviors: {},
    chat: { enabled: false, messages: [], minIntervalMs: 1, maxIntervalMs: 2 },
    playerPause: { radius: 16 },
    safeZone: { x: null, y: null, z: null, radius: 32 },
    blockInteraction: { mode: 'off', boundless: false },
    hazards: { enabled: true },
    cycle: { minMs: 1, maxMs: 2 },
    ...over,
  };
}

const cfg = config();

describe('behavior canRun gates (masterdoc §7)', () => {
  it('sneak: eligible whenever the bot has a position', () => {
    expect(get('sneak').canRun(state(), cfg)).toBe(true);
    expect(get('sneak').canRun(state({ position: null }), cfg)).toBe(false);
  });

  it('swim: only while in water', () => {
    expect(get('swim').canRun(state({ isInWater: true }), cfg)).toBe(true);
    expect(get('swim').canRun(state({ isInWater: false }), cfg)).toBe(false);
  });

  it('eat: only when hungry and holding food', () => {
    const inv = { hasFood: true, hasFishingRod: false, tossableItemCount: 0 };
    expect(get('eat').canRun(state({ food: 10, inventory: inv }), cfg)).toBe(true);
    expect(get('eat').canRun(state({ food: 20, inventory: inv }), cfg)).toBe(false); // full
    expect(get('eat').canRun(state({ food: 10 }), cfg)).toBe(false); // no food item
  });

  it('fish: only with a rod near water', () => {
    const rod = { hasFood: false, hasFishingRod: true, tossableItemCount: 0 };
    expect(get('fish').canRun(state({ inventory: rod, nearby: { ...state().nearby, water: true } }), cfg)).toBe(true);
    expect(get('fish').canRun(state({ inventory: rod }), cfg)).toBe(false); // no water
  });

  it('sleep: only at night near a bed', () => {
    const nearBed = { ...state().nearby, bed: true };
    expect(get('sleep').canRun(state({ isDay: false, nearby: nearBed }), cfg)).toBe(true);
    expect(get('sleep').canRun(state({ isDay: true, nearby: nearBed }), cfg)).toBe(false); // daytime
    expect(get('sleep').canRun(state({ isDay: false }), cfg)).toBe(false); // no bed
  });

  it('doors/boat/lookAtEntity: gated by their nearby flag', () => {
    expect(get('doors').canRun(state({ nearby: { ...state().nearby, door: true } }), cfg)).toBe(true);
    expect(get('boat').canRun(state({ nearby: { ...state().nearby, boat: true } }), cfg)).toBe(true);
    expect(get('lookAtEntity').canRun(state({ nearby: { ...state().nearby, entity: true } }), cfg)).toBe(true);
    expect(get('doors').canRun(state(), cfg)).toBe(false);
  });

  it('itemDropPickup: only with a tossable stack', () => {
    const inv = { hasFood: false, hasFishingRod: false, tossableItemCount: 3 };
    expect(get('itemDropPickup').canRun(state({ inventory: inv }), cfg)).toBe(true);
    expect(get('itemDropPickup').canRun(state(), cfg)).toBe(false);
  });

  it('mineBlocks: disabled unless a block-interaction mode is set', () => {
    expect(get('mineBlocks').canRun(state(), config({ blockInteraction: { mode: 'off', boundless: false } }))).toBe(false);
    expect(get('mineBlocks').canRun(state(), config({ blockInteraction: { mode: 'radius-any', boundless: false } }))).toBe(true);
    expect(get('mineBlocks').canRun(state(), config({ blockInteraction: { mode: 'self-placed-only', boundless: false } }))).toBe(true);
  });
});
