import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bot } from 'mineflayer';
import { BehaviorEngine } from '../src/bot/behaviorEngine.js';
import { LiveStateStore } from '../src/bot/state.js';
import type { AFKBehavior, BotState, NeoBotConfig } from '../src/bot/behaviors/types.js';

function makeConfig(overrides: Partial<NeoBotConfig> = {}): NeoBotConfig {
  return {
    behaviors: {
      alpha: { enabled: true, weight: 1 },
      beta: { enabled: true, weight: 1 },
      disabledOne: { enabled: false, weight: 5 },
    },
    chat: { enabled: false, messages: [], minIntervalMs: 1000, maxIntervalMs: 2000 },
    playerPause: { radius: 16 },
    safeZone: { x: null, y: null, z: null, radius: 32 },
    cycle: { minMs: 3000, maxMs: 9000 },
    ...overrides,
  };
}

const ran: string[] = [];
function fakeBehavior(name: string, opts: Partial<AFKBehavior> = {}): AFKBehavior {
  return {
    name,
    enabledByDefault: true,
    weight: 1,
    canRun: opts.canRun ?? (() => true),
    run: opts.run ?? (() => { ran.push(name); return Promise.resolve(); }),
  };
}

interface FakeBot {
  username: string;
  entity: { position: { x: number; y: number; z: number }; yaw: number; onGround: boolean };
  players: Record<string, { username: string; entity: { position: { x: number; y: number; z: number } } | null }>;
  health: number;
  food: number;
  setControlState: ReturnType<typeof vi.fn>;
  clearControlStates: ReturnType<typeof vi.fn>;
  pathfinder: { stop: ReturnType<typeof vi.fn> };
  look: ReturnType<typeof vi.fn>;
  chat: ReturnType<typeof vi.fn>;
}

function makeBot(players: FakeBot['players'] = {}): FakeBot {
  return {
    username: 'NeoBot',
    entity: { position: { x: 0, y: 64, z: 0 }, yaw: 0, onGround: true },
    players,
    health: 20,
    food: 20,
    setControlState: vi.fn(),
    clearControlStates: vi.fn(),
    pathfinder: { stop: vi.fn() },
    look: vi.fn(() => Promise.resolve()),
    chat: vi.fn(),
  };
}

const asBot = (b: FakeBot): Bot => b as unknown as Bot;

describe('BehaviorEngine', () => {
  let state: LiveStateStore;

  beforeEach(() => {
    vi.useFakeTimers();
    state = new LiveStateStore();
    ran.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseState: BotState = {
    self: 'NeoBot',
    position: { x: 0, y: 64, z: 0 },
    health: 20,
    food: 20,
    onGround: true,
    players: [],
  };

  it('selects only enabled + eligible behaviors', () => {
    const engine = new BehaviorEngine(state, makeConfig(), {
      behaviors: [
        fakeBehavior('alpha'),
        fakeBehavior('beta', { canRun: () => false }),
        fakeBehavior('disabledOne'),
      ],
      rng: () => 0.1,
    });
    // beta is ineligible (canRun false), disabledOne is disabled in config → alpha.
    expect(engine.selectBehavior(baseState)?.name).toBe('alpha');
  });

  it('runs the selected behavior and reflects it as currentActivity', async () => {
    const engine = new BehaviorEngine(state, makeConfig(), {
      behaviors: [fakeBehavior('alpha')],
      rng: () => 0.1,
    });
    engine.start(asBot(makeBot()));
    const activity = await engine.runCycleOnce();
    expect(activity).toBe('alpha');
    expect(ran).toContain('alpha');
    expect(state.getSnapshot().currentActivity).toBe('alpha');
    engine.stop();
  });

  it('pauses all activity when a player is within the radius', async () => {
    const engine = new BehaviorEngine(state, makeConfig(), {
      behaviors: [fakeBehavior('alpha')],
      rng: () => 0.1,
    });
    const bot = makeBot({ Steve: { username: 'Steve', entity: { position: { x: 3, y: 64, z: 3 } } } });
    engine.start(asBot(bot));

    const activity = await engine.runCycleOnce();
    expect(activity).toBeNull();
    expect(ran).not.toContain('alpha');
    expect(state.getSnapshot().currentActivity).toBe('paused: player nearby');
    expect(bot.clearControlStates).toHaveBeenCalled();
    engine.stop();
  });

  it('resumes once the area is clear', async () => {
    const engine = new BehaviorEngine(state, makeConfig(), {
      behaviors: [fakeBehavior('alpha')],
      rng: () => 0.1,
    });
    const bot = makeBot({ Steve: { username: 'Steve', entity: { position: { x: 3, y: 64, z: 3 } } } });
    engine.start(asBot(bot));

    expect(await engine.runCycleOnce()).toBeNull(); // paused
    bot.players = {}; // player left
    expect(await engine.runCycleOnce()).toBe('alpha'); // resumed
    engine.stop();
  });

  it('de-weights the just-run behavior to avoid repetitive sequences', async () => {
    // rng=0.35: with no history alpha wins (threshold 0.5); after alpha runs it
    // is damped, shifting the same roll to beta.
    const engine = new BehaviorEngine(state, makeConfig(), {
      behaviors: [fakeBehavior('alpha'), fakeBehavior('beta')],
      rng: () => 0.35,
    });
    engine.start(asBot(makeBot()));
    expect(await engine.runCycleOnce()).toBe('alpha');
    expect(await engine.runCycleOnce()).toBe('beta');
    engine.stop();
  });

  it('stop() releases controls and goes idle', () => {
    const engine = new BehaviorEngine(state, makeConfig(), { behaviors: [fakeBehavior('alpha')] });
    const bot = makeBot();
    engine.start(asBot(bot));
    engine.stop();
    expect(bot.clearControlStates).toHaveBeenCalled();
    expect(bot.pathfinder.stop).toHaveBeenCalled();
    expect(state.getSnapshot().currentActivity).toBe('idle');
  });
});
