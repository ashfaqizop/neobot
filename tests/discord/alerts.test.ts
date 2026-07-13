import { describe, expect, it, vi } from 'vitest';
import { DiscordAlerter, shouldDispatch } from '../../src/discord/alerts.js';
import type { AlertSetting, AlertSettingsRepository } from '../../src/db/types.js';

describe('shouldDispatch', () => {
  it('fires enabled events, skips disabled, and fails open for unknown keys', () => {
    const settings: AlertSetting[] = [
      { eventKey: 'connected', enabled: true },
      { eventKey: 'banned', enabled: false },
    ];
    expect(shouldDispatch('connected', settings)).toBe(true);
    expect(shouldDispatch('banned', settings)).toBe(false);
    expect(shouldDispatch('never_seen', settings)).toBe(true);
  });
});

function fakeSettings(list: AlertSetting[]): AlertSettingsRepository {
  return {
    list: vi.fn(() => Promise.resolve(list)),
    setEnabled: vi.fn(() => Promise.resolve()),
    ensureDefaults: vi.fn(() => Promise.resolve()),
  };
}

describe('DiscordAlerter.dispatch', () => {
  it('sends enabled alerts and suppresses muted ones', async () => {
    const send = vi.fn(() => Promise.resolve());
    const settings = fakeSettings([
      { eventKey: 'connected', enabled: true },
      { eventKey: 'banned', enabled: false },
    ]);
    const alerter = new DiscordAlerter(send, settings);

    await alerter.dispatch({ key: 'connected', message: 'up' });
    expect(send).toHaveBeenCalledTimes(1);

    await alerter.dispatch({ key: 'banned', message: 'down' });
    expect(send).toHaveBeenCalledTimes(1); // still 1 — muted

    await alerter.dispatch({ key: 'kicked', message: 'kick' });
    expect(send).toHaveBeenCalledTimes(2); // unknown key → fail-open
  });

  it('never throws when the sender fails', async () => {
    const send = vi.fn(() => Promise.reject(new Error('discord down')));
    const alerter = new DiscordAlerter(send, fakeSettings([{ eventKey: 'connected', enabled: true }]));
    await expect(alerter.dispatch({ key: 'connected', message: 'up' })).resolves.toBeUndefined();
  });
});
