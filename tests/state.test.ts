import { describe, expect, it, beforeEach } from 'vitest';
import { LiveStateStore, type StateSnapshot } from '../src/bot/state.js';

describe('LiveStateStore', () => {
  let clock: number;
  const now = (): number => clock;
  let store: LiveStateStore;

  beforeEach(() => {
    clock = 1_000_000; // fixed epoch base
    store = new LiveStateStore(now);
  });

  it('defaults to not-configured with a §10-shaped payload', () => {
    const p = store.getStatusPayload();
    expect(p.status).toBe('not-configured');
    expect(p.currentActivity).toBeNull();
    expect(typeof p.version).toBe('string');
    expect(p.uptimePercent).toBe(0);
    expect(() => new Date(p.lastUpdated).toISOString()).not.toThrow();
  });

  it('setWorld records position + player count in the snapshot without emitting', () => {
    let updates = 0;
    store.on('update', () => (updates += 1));
    store.setWorld({ position: { x: 12.4, y: 64, z: -8.1 }, playerCount: 3 });

    const snap = store.getSnapshot();
    expect(snap.position).toEqual({ x: 12.4, y: 64, z: -8.1 });
    expect(snap.playerCount).toBe(3);
    // Silent by design (sampled ~500ms) — must not flood the socket/persistence.
    expect(updates).toBe(0);
    // ...and it stays out of the public /status.json payload (no position leak).
    expect(store.getStatusPayload()).not.toHaveProperty('position');
  });

  it('emits an update event when status changes', () => {
    let received: unknown = null;
    store.on('update', (payload) => (received = payload));
    store.setStatus('connecting');
    expect(received).not.toBeNull();
    expect((received as { status: string }).status).toBe('connecting');
  });

  it('records sessions and computes uptime percent', () => {
    clock = 1_000_000;
    store.recordSessionStart();
    store.setStatus('connected', 'idle');

    // 60s connected...
    clock = 1_060_000;
    store.recordSessionEnd('socketClosed');

    // ...then 60s disconnected (observed window = 120s, connected = 60s).
    clock = 1_120_000;

    // Store was created at clock=1_000_000, so observed = 120s, connected = 60s → 50%.
    expect(store.uptimePercent()).toBeCloseTo(50, 1);
  });

  it('counts an open (still-connected) session up to now', () => {
    clock = 1_000_000;
    store.recordSessionStart();
    clock = 1_050_000; // 50s later, still connected; observed 50s → 100%
    expect(store.uptimePercent()).toBeCloseTo(100, 1);
  });

  it('tracks the last disconnect reason and bounds reconnect history', () => {
    for (let i = 0; i < 60; i++) {
      store.recordReconnect(`reason ${i}`, 'network');
    }
    const snap = store.getSnapshot();
    expect(snap.reconnectHistory.length).toBeLessThanOrEqual(50);
    store.recordSessionStart();
    store.recordSessionEnd('banned!');
    expect(store.getSnapshot().lastDisconnectReason).toBe('banned!');
  });

  it('emits session:start and session:end events (Phase 5 mirroring)', () => {
    const starts: { connectedAt: string }[] = [];
    const ends: { disconnectedAt: string; reason: string | null }[] = [];
    store.on('session:start', (p: { connectedAt: string }) => starts.push(p));
    store.on('session:end', (p: { disconnectedAt: string; reason: string | null }) => ends.push(p));

    store.recordSessionStart();
    clock = 1_030_000;
    store.recordSessionEnd('socketClosed');

    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
    expect(ends[0]?.reason).toBe('socketClosed');
  });

  it('hydrate() restores status/activity/sessions and keeps uptime continuity', () => {
    const snapshot: StateSnapshot = {
      status: 'connected',
      currentActivity: 'walk',
      lastDisconnectReason: 'earlier',
      uptimePercent: 0,
      sessions: [
        {
          connectedAt: new Date(1_000_000).toISOString(),
          disconnectedAt: new Date(1_060_000).toISOString(),
          disconnectReason: 'earlier',
        },
      ],
      reconnectHistory: [],
      position: null,
      playerCount: 0,
      startedAt: new Date(1_000_000).toISOString(),
      lastUpdated: new Date(1_060_000).toISOString(),
    };

    clock = 1_120_000; // 120s of observed time since the restored startedAt
    store.hydrate(snapshot);

    const snap = store.getSnapshot();
    expect(snap.status).toBe('connected');
    expect(snap.currentActivity).toBe('walk');
    expect(snap.sessions).toHaveLength(1);
    // 60s connected out of 120s observed → 50%.
    expect(store.uptimePercent()).toBeCloseTo(50, 1);
  });
});
