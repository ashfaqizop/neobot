import { describe, expect, it } from 'vitest';
import { LiveStateStore } from '../../src/bot/state.js';
import { InMemoryLiveStateRepository } from '../../src/db/repositories/liveState.js';
import { InMemoryEventsRepository } from '../../src/db/repositories/events.js';
import { InMemorySessionsRepository } from '../../src/db/repositories/sessions.js';
import { InMemoryAdminUsersRepository } from '../../src/db/repositories/adminUsers.js';
import { InMemoryAlertSettingsRepository } from '../../src/db/repositories/alertSettings.js';

describe('in-memory live-state repository', () => {
  it('round-trips a snapshot', async () => {
    const store = new LiveStateStore();
    store.setStatus('connected', 'walk');
    const repo = new InMemoryLiveStateRepository();
    expect(await repo.load()).toBeNull();
    await repo.save(store.getSnapshot());
    const loaded = await repo.load();
    expect(loaded?.status).toBe('connected');
    expect(loaded?.currentActivity).toBe('walk');
  });
});

describe('in-memory events repository', () => {
  it('appends and returns recent events newest-first', async () => {
    const repo = new InMemoryEventsRepository();
    await repo.append({ level: 'info', category: 'connection', message: 'one' });
    await repo.append({ level: 'warn', category: 'connection', message: 'two' });
    const recent = await repo.recent(10);
    expect(recent.map((e) => e.message)).toEqual(['two', 'one']);
    expect(recent[0]?.id).toBeGreaterThan(0);
  });

  it('honors the limit', async () => {
    const repo = new InMemoryEventsRepository();
    for (let i = 0; i < 5; i++) await repo.append({ level: 'info', category: 'x', message: `m${i}` });
    expect(await repo.recent(2)).toHaveLength(2);
  });
});

describe('in-memory sessions repository', () => {
  it('starts, ends, and lists sessions', async () => {
    const repo = new InMemorySessionsRepository();
    const id = await repo.start('2026-01-01T00:00:00Z');
    await repo.end(id, '2026-01-01T01:00:00Z', 'socketClosed');
    const recent = await repo.recent();
    expect(recent[0]?.id).toBe(id);
    expect(recent[0]?.disconnectReason).toBe('socketClosed');
    expect(recent[0]?.disconnectedAt).toBe('2026-01-01T01:00:00Z');
  });
});

describe('in-memory alert settings repository', () => {
  it('seeds defaults without clobbering existing toggles', async () => {
    const repo = new InMemoryAlertSettingsRepository();
    await repo.ensureDefaults(['connected', 'banned']);
    expect(await repo.list()).toHaveLength(2);

    await repo.setEnabled('connected', false);
    await repo.ensureDefaults(['connected', 'kicked']); // adds kicked, keeps connected=false
    const list = await repo.list();
    expect(list.find((s) => s.eventKey === 'connected')?.enabled).toBe(false);
    expect(list.find((s) => s.eventKey === 'kicked')?.enabled).toBe(true);
    expect(list).toHaveLength(3);
  });
});

describe('in-memory admin users repository', () => {
  it('creates, finds, and counts', async () => {
    const repo = new InMemoryAdminUsersRepository();
    expect(await repo.count()).toBe(0);
    const user = await repo.create('admin', 'hash123');
    expect(user.username).toBe('admin');
    expect(await repo.findByUsername('admin')).toMatchObject({ username: 'admin', passwordHash: 'hash123' });
    expect(await repo.findByUsername('nobody')).toBeNull();
    expect(await repo.count()).toBe(1);
  });
});
