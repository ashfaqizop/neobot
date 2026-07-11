import { describe, expect, it, beforeEach } from 'vitest';
import { LiveStateStore } from '../src/bot/state.js';

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
});
