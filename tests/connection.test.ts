import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionManager, type BotConnectOptions, type BotLike } from '../src/bot/connection.js';
import { LiveStateStore } from '../src/bot/state.js';

class FakeBot extends EventEmitter implements BotLike {
  quit = vi.fn();
}

const CONFIG: BotConnectOptions = {
  host: 'mc.example.com',
  port: 25565,
  username: 'NeoBot',
  version: undefined,
};

describe('ConnectionManager', () => {
  let state: LiveStateStore;
  let bots: FakeBot[];
  let botFactory: (opts: BotConnectOptions) => BotLike;

  beforeEach(() => {
    vi.useFakeTimers();
    state = new LiveStateStore();
    bots = [];
    botFactory = () => {
      const b = new FakeBot();
      bots.push(b);
      return b;
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('idles gracefully (not-configured) when there is no config, without throwing', () => {
    const cm = new ConnectionManager(state, { getConfig: () => null, botFactory });
    expect(() => cm.start()).not.toThrow();
    expect(state.getStatus()).toBe('not-configured');
    expect(bots.length).toBe(0);
  });

  it('marks connected and records a session on spawn', () => {
    const cm = new ConnectionManager(state, { getConfig: () => CONFIG, botFactory });
    cm.start();
    expect(state.getStatus()).toBe('connecting');
    bots[0]!.emit('spawn');
    expect(state.getStatus()).toBe('connected');
    expect(state.getSnapshot().sessions.length).toBe(1);
  });

  it('stops cold on a terminal (banned) disconnect — no reconnect', () => {
    const cm = new ConnectionManager(state, { getConfig: () => CONFIG, botFactory });
    cm.start();
    bots[0]!.emit('spawn');
    bots[0]!.emit('kicked', 'You are banned from this server');
    bots[0]!.emit('end', 'disconnect');

    expect(state.getStatus()).toBe('banned');
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(bots.length).toBe(1); // never reconnected
  });

  it('reconnects after a network disconnect once the backoff elapses', () => {
    const cm = new ConnectionManager(state, {
      getConfig: () => CONFIG,
      botFactory,
      baseBackoffMs: 1000,
      jitterMs: 0,
    });
    cm.start();
    bots[0]!.emit('spawn');
    bots[0]!.emit('end', 'socketClosed');

    expect(state.getStatus()).toBe('reconnecting');
    expect(bots.length).toBe(1);

    // attempt is now 1 → backoff = base·2¹ = 2000ms.
    vi.advanceTimersByTime(2000);
    expect(bots.length).toBe(2); // reconnected with a fresh bot
  });

  it('gives up after maxRetries and fires a reconnect_failed alert', () => {
    const onAlert = vi.fn();
    const cm = new ConnectionManager(state, {
      getConfig: () => CONFIG,
      botFactory,
      maxRetries: 2,
      baseBackoffMs: 100,
      jitterMs: 0,
      onAlert,
    });
    cm.start();

    // Fail repeatedly: initial + retries.
    for (let i = 0; i < 5; i++) {
      const bot = bots[bots.length - 1]!;
      bot.emit('end', 'socketClosed');
      vi.advanceTimersByTime(100_000);
    }

    expect(state.getStatus()).toBe('disconnected');
    expect(onAlert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'reconnect_failed' }),
    );
  });

  it('hibernating host → polls without counting retries and shows hibernating-wait', () => {
    const onAlert = vi.fn();
    const cm = new ConnectionManager(state, {
      getConfig: () => CONFIG,
      botFactory,
      maxRetries: 2,
      hibernationPollMs: 5000,
      onAlert,
    });
    cm.start();

    // Repeatedly hit the hibernation state far more than maxRetries.
    for (let i = 0; i < 6; i++) {
      bots[bots.length - 1]!.emit('end', 'Server is starting, please wait');
      expect(state.getStatus()).toBe('hibernating-wait');
      vi.advanceTimersByTime(5000); // steady poll interval → new bot
    }

    // Never gave up (poll doesn't trip maxRetries) and alerted once on entry.
    bots[bots.length - 1]!.emit('end', 'Position in queue: 1');
    expect(state.getStatus()).toBe('hibernating-wait');
    expect(onAlert).toHaveBeenCalledTimes(1);
    expect(onAlert).toHaveBeenCalledWith(expect.objectContaining({ key: 'hibernating' }));
    expect(bots.length).toBeGreaterThan(3);
  });

  it('absorbs a late error from a discarded bot without crashing (regression)', () => {
    // mineflayer's auto-version ping can emit 'error' on the old bot AFTER
    // teardown; without an absorber this throws and kills the daemon.
    const cm = new ConnectionManager(state, {
      getConfig: () => CONFIG,
      botFactory,
      baseBackoffMs: 1000,
      jitterMs: 0,
    });
    cm.start();
    const first = bots[0]!;
    first.emit('spawn');
    first.emit('end', 'socketClosed'); // triggers teardown

    // A late error on the discarded bot must not throw.
    expect(() => first.emit('error', new Error('late ECONNREFUSED'))).not.toThrow();
  });

  it('invokes the anti-cheat hook on an anti-cheat kick', () => {
    const onAntiCheat = vi.fn();
    const cm = new ConnectionManager(state, {
      getConfig: () => CONFIG,
      botFactory,
      baseBackoffMs: 10,
      jitterMs: 0,
      onAntiCheat,
    });
    cm.start();
    bots[0]!.emit('spawn');
    bots[0]!.emit('kicked', 'Kicked by Grim: illegal movement (flight)');
    bots[0]!.emit('end', 'disconnect');
    expect(onAntiCheat).toHaveBeenCalledOnce();
  });

  it('stop() quits the active bot and marks disconnected', () => {
    const cm = new ConnectionManager(state, { getConfig: () => CONFIG, botFactory });
    cm.start();
    bots[0]!.emit('spawn');

    cm.stop();
    expect(bots[0]!.quit).toHaveBeenCalledOnce();
    expect(state.getStatus()).toBe('disconnected');
  });

  it('stop() cancels a pending reconnect', () => {
    const cm = new ConnectionManager(state, {
      getConfig: () => CONFIG,
      botFactory,
      baseBackoffMs: 1000,
      jitterMs: 0,
    });
    cm.start();
    bots[0]!.emit('spawn');
    bots[0]!.emit('end', 'socketClosed'); // schedules reconnect, tears down bot

    cm.stop();
    vi.advanceTimersByTime(10_000);
    expect(bots.length).toBe(1); // reconnect was cancelled
    expect(state.getStatus()).toBe('disconnected');
  });
});
