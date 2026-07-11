import { describe, expect, it } from 'vitest';
import { findNearbyPlayers, isPlayerNearby } from '../src/bot/playerPresence.js';
import type { BotState, PlayerInfo } from '../src/bot/behaviors/types.js';

function state(overrides: Partial<BotState> = {}): BotState {
  return {
    self: 'NeoBot',
    position: { x: 0, y: 64, z: 0 },
    health: 20,
    food: 20,
    onGround: true,
    players: [],
    ...overrides,
  };
}

const player = (username: string, pos: PlayerInfo['position']): PlayerInfo => ({
  username,
  position: pos,
});

describe('player presence (masterdoc §7 safety default)', () => {
  it('excludes the bot itself', () => {
    const s = state({ players: [player('NeoBot', { x: 1, y: 64, z: 1 })] });
    expect(findNearbyPlayers(s, 16)).toHaveLength(0);
    expect(isPlayerNearby(s, 16)).toBe(false);
  });

  it('detects a real player within the radius', () => {
    const s = state({ players: [player('Steve', { x: 5, y: 64, z: 5 })] });
    expect(isPlayerNearby(s, 16)).toBe(true);
    expect(findNearbyPlayers(s, 16)[0]?.username).toBe('Steve');
  });

  it('respects the radius boundary', () => {
    const s = state({ players: [player('Steve', { x: 20, y: 64, z: 0 })] });
    expect(isPlayerNearby(s, 16)).toBe(false);
    expect(isPlayerNearby(s, 25)).toBe(true);
  });

  it('ignores players with unknown position', () => {
    const s = state({ players: [player('Ghost', null)] });
    expect(isPlayerNearby(s, 100)).toBe(false);
  });

  it('returns empty when the bot position is unknown', () => {
    const s = state({ position: null, players: [player('Steve', { x: 1, y: 64, z: 1 })] });
    expect(findNearbyPlayers(s, 16)).toHaveLength(0);
  });
});
