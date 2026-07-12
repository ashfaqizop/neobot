import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveStateStore } from '../../src/bot/state.js';
import { attachStatePersistence } from '../../src/db/statePersistence.js';
import { InMemoryLiveStateRepository } from '../../src/db/repositories/liveState.js';
import { InMemoryEventsRepository } from '../../src/db/repositories/events.js';
import { InMemorySessionsRepository } from '../../src/db/repositories/sessions.js';
import { InMemoryAdminUsersRepository } from '../../src/db/repositories/adminUsers.js';
import { InMemoryAlertSettingsRepository } from '../../src/db/repositories/alertSettings.js';
import type { Repositories } from '../../src/db/types.js';

function inMemoryRepos(): Repositories {
  return {
    config: { get: () => Promise.resolve(null), save: () => Promise.resolve(), getOrBootstrap: (d) => Promise.resolve(d) },
    liveState: new InMemoryLiveStateRepository(),
    events: new InMemoryEventsRepository(),
    sessions: new InMemorySessionsRepository(),
    adminUsers: new InMemoryAdminUsersRepository(),
    alertSettings: new InMemoryAlertSettingsRepository(),
  };
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('attachStatePersistence', () => {
  afterEach(() => vi.useRealTimers());

  it('mirrors session start/end to the sessions repo with id correlation', async () => {
    const repos = inMemoryRepos();
    const state = new LiveStateStore();
    attachStatePersistence(state, repos);

    state.recordSessionStart();
    await flush(); // let sessions.start() resolve and set the current id
    state.recordSessionEnd('socketClosed');
    await flush();

    const sessions = await repos.sessions.recent();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.disconnectReason).toBe('socketClosed');
    expect(sessions[0]?.disconnectedAt).not.toBeNull();
  });

  it('debounces live-state saves', async () => {
    vi.useFakeTimers();
    const repos = inMemoryRepos();
    const saveSpy = vi.spyOn(repos.liveState, 'save');
    const state = new LiveStateStore();
    attachStatePersistence(state, repos);

    state.setStatus('connected');
    state.setActivity('walk'); // multiple rapid updates
    expect(saveSpy).not.toHaveBeenCalled(); // still within the debounce window

    await vi.advanceTimersByTimeAsync(3_000);
    expect(saveSpy).toHaveBeenCalledTimes(1); // coalesced into one save
  });

  it('detaches cleanly', () => {
    const repos = inMemoryRepos();
    const detach = attachStatePersistence(state_(), repos);
    expect(() => detach()).not.toThrow();
  });
});

function state_(): LiveStateStore {
  return new LiveStateStore();
}
