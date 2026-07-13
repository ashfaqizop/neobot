import { describe, expect, it } from 'vitest';
import { humanizeActivity, humanizeCategory, humanizeError } from './humanize.ts';

describe('humanizeCategory', () => {
  it('maps disconnect enums to plain language', () => {
    expect(humanizeCategory('server_restart')).toBe('Server restart');
    expect(humanizeCategory('anticheat')).toBe('Anti-cheat');
    expect(humanizeCategory('afk')).toBe('AFK kick');
  });
  it('titleizes unknown values instead of leaking them raw', () => {
    expect(humanizeCategory('some_new_reason')).toBe('Some new reason');
  });
});

describe('humanizeActivity', () => {
  it('friendly-labels behavior identifiers', () => {
    expect(humanizeActivity('jumpLook')).toBe('Jump & look');
    expect(humanizeActivity('pathfindRandom')).toBe('Pathfinding');
    expect(humanizeActivity(null)).toBe('Idle');
  });
  it('rewrites prefixed states', () => {
    expect(humanizeActivity('paused: manual')).toBe('Paused — by you');
    expect(humanizeActivity('hazard: lava')).toBe('Avoiding hazard — lava');
  });
  it('falls back to titleized text for unknown behaviors', () => {
    expect(humanizeActivity('someNewBehavior')).toBe('Some New Behavior');
  });
});

describe('humanizeError', () => {
  it('maps known API error codes to sentences', () => {
    expect(humanizeError('invalid_config')).toMatch(/invalid/i);
    expect(humanizeError('already_configured')).toMatch(/already configured/i);
  });
  it('passes through prose messages unchanged', () => {
    expect(humanizeError('Network error — is the server reachable?')).toBe(
      'Network error — is the server reachable?',
    );
  });
});
