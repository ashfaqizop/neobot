import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Bot } from 'mineflayer';
import { LiveStateStore } from '../../src/bot/state.js';
import { BehaviorEngine } from '../../src/bot/behaviorEngine.js';
import { ConnectionManager } from '../../src/bot/connection.js';
import { BotController } from '../../src/bot/controller.js';
import { SafeModeManager } from '../../src/bot/safeMode.js';
import { MemoryWatchdog } from '../../src/watchdog/memoryWatchdog.js';
import { buildDefaultAppConfig } from '../../src/config/appConfig.js';
import { env } from '../../src/config/env.js';
import type { AlertEvent, BotStatus } from '../../src/bot/types.js';
import { startTestWorld, type TestWorld } from './support/mcServer.js';
import { waitFor } from './support/wait.js';

/**
 * Real bot ↔ real world, with fault injection. The full Mineflayer connection,
 * behavior engine, Safe Mode manager, and memory watchdog run against a live
 * flying-squid server — nothing on the bot path is mocked. Kicks are injected
 * server-side to drive the disconnect/reconnect/dial-back logic for real.
 */
describe('bot ↔ live Minecraft world', () => {
  let world: TestWorld;

  beforeAll(async () => {
    world = await startTestWorld();
  }, 40_000);

  afterAll(async () => {
    await world?.stop();
  });

  interface Stack {
    state: LiveStateStore;
    engine: BehaviorEngine;
    connection: ConnectionManager;
    controller: BotController;
    safeMode: SafeModeManager;
    /** De-duplicated status transitions (consecutive duplicates collapsed). */
    transitions: BotStatus[];
    alerts: AlertEvent[];
    stop(): void;
  }

  const stacks: Stack[] = [];

  /** Wire the real stack (mirrors src/index.ts) pointed at the local world. */
  function buildStack(username: string, safeModeThreshold = 2): Stack {
    const state = new LiveStateStore();
    const config = buildDefaultAppConfig(env);
    const transitions: BotStatus[] = [];
    const alerts: AlertEvent[] = [];

    state.on('update', (p: { status: BotStatus }) => {
      if (transitions[transitions.length - 1] !== p.status) transitions.push(p.status);
    });

    const engine = new BehaviorEngine(state, config.behavior);
    let safeMode: SafeModeManager;
    const connection = new ConnectionManager(state, {
      getConfig: () => ({ host: world.host, port: world.port, username, version: world.version }),
      onBotReady: (bot) => engine.start(bot as unknown as Bot),
      onBotEnd: () => engine.stop(),
      onAlert: (e) => alerts.push(e),
      onAntiCheat: () => safeMode.recordAntiCheat(),
      // Fast timers so reconnect/poll cycles complete within the test budget.
      baseBackoffMs: 300,
      maxBackoffMs: 800,
      jitterMs: 0,
      immediateRetryMs: 300,
      hibernationPollMs: 700,
      maxRetries: 20,
    });
    const controller = new BotController(connection, engine, state);
    safeMode = new SafeModeManager({
      threshold: safeModeThreshold,
      windowMs: 60_000,
      autoDetect: true,
      setSafeMode: (on) => controller.setSafeMode(on),
      onAlert: (e) => alerts.push(e),
    });

    const stack: Stack = {
      state,
      engine,
      connection,
      controller,
      safeMode,
      transitions,
      alerts,
      stop() {
        engine.stop();
        connection.stop();
      },
    };
    stacks.push(stack);
    return stack;
  }

  afterEach(() => {
    while (stacks.length) stacks.pop()?.stop();
  });

  const connected = (s: Stack): boolean => s.state.getStatusPayload().status === 'connected';
  const countConnected = (t: BotStatus[]): number => t.filter((s) => s === 'connected').length;

  it('connects, spawns, and starts anti-AFK activity', async () => {
    const s = buildStack('NeoBotConnect');
    s.connection.start();

    await waitFor(() => connected(s), { timeoutMs: 30_000, label: 'connected' });
    await waitFor(
      () => {
        const a = s.state.getStatusPayload().currentActivity;
        return a != null && a !== 'idle';
      },
      { timeoutMs: 20_000, label: 'an activity to start' },
    );

    expect(s.state.getStatusPayload().status).toBe('connected');
    expect(s.state.getStatusPayload().currentActivity).toBeTruthy();
  });

  it('reconnects automatically after a kick', async () => {
    const s = buildStack('NeoBotKick');
    s.connection.start();
    await waitFor(() => connected(s), { timeoutMs: 30_000, label: 'first connect' });

    world.kick('NeoBotKick', 'kicked by test');

    // Should leave 'connected', pass through reconnecting/connecting, and land
    // back on 'connected' — a second connected transition.
    await waitFor(() => countConnected(s.transitions) >= 2, {
      timeoutMs: 20_000,
      label: 'reconnect after kick',
    });
    expect(s.transitions).toContain('reconnecting');
    expect(connected(s)).toBe(true);
  });

  it('enters hibernating-wait (polls, not retry-budget) on a "server starting" kick', async () => {
    const s = buildStack('NeoBotHib');
    s.connection.start();
    await waitFor(() => connected(s), { timeoutMs: 30_000, label: 'first connect' });

    world.kick('NeoBotHib', 'Server is starting, please wait');

    await waitFor(() => s.transitions.includes('hibernating-wait'), {
      timeoutMs: 15_000,
      label: 'hibernating-wait status',
    });
    // Alert should fire exactly once for the hibernation entry.
    expect(s.alerts.filter((a) => a.key === 'hibernating')).toHaveLength(1);
    // It keeps polling and rejoins the still-up world.
    await waitFor(() => countConnected(s.transitions) >= 2, {
      timeoutMs: 20_000,
      label: 'rejoin after hibernation poll',
    });
  });

  it('auto-engages Safe Mode after repeated anti-cheat kicks', async () => {
    const s = buildStack('NeoBotAC', 2);
    s.connection.start();
    await waitFor(() => connected(s), { timeoutMs: 30_000, label: 'first connect' });

    // First anti-cheat kick → reconnect.
    world.kick('NeoBotAC', 'Kicked for cheating (flying)');
    await waitFor(() => countConnected(s.transitions) >= 2, {
      timeoutMs: 20_000,
      label: 'reconnect after 1st anti-cheat kick',
    });

    // Second anti-cheat kick → crosses threshold → Safe Mode.
    world.kick('NeoBotAC', 'Suspicious movement detected');
    await waitFor(() => s.alerts.some((a) => a.key === 'safe_mode'), {
      timeoutMs: 20_000,
      label: 'safe_mode alert',
    });
    expect(s.alerts.some((a) => a.key === 'safe_mode')).toBe(true);
  });
});

/**
 * Memory watchdog tiered recovery — real timers, injected memory reading. No
 * world needed; the point is the tier1→tier2 escalation against a real
 * controller seam.
 */
describe('memory watchdog tiered recovery (live timers)', () => {
  it('restarts the connection (tier1) then escalates to process exit (tier2)', async () => {
    const restartConnection = vi.fn();
    const restartProcess = vi.fn();

    const watchdog = new MemoryWatchdog({
      thresholdBytes: 1, // always "over" → trips immediately
      checkIntervalMs: 100,
      graceMs: 400,
      restartConnection,
      restartProcess,
      readMemory: () => 1024 * 1024 * 1024, // 1 GB, well over threshold
    }).start();

    try {
      await waitFor(() => restartConnection.mock.calls.length >= 1, {
        timeoutMs: 5_000,
        label: 'tier1 connection restart',
      });
      await waitFor(() => restartProcess.mock.calls.length >= 1, {
        timeoutMs: 5_000,
        label: 'tier2 process exit',
      });
      expect(restartConnection).toHaveBeenCalled();
      expect(restartProcess).toHaveBeenCalled();
    } finally {
      watchdog.stop();
    }
  });
});
