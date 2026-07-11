/**
 * Behavior engine / scheduler (masterdoc §7).
 *
 * Runs while the bot is spawned: on a humanized interval it selects one eligible
 * behavior (by weight) and runs it, unless a real player is nearby — in which
 * case ALL activity pauses (an always-on safety default, not a toggle).
 *
 * The current behavior is surfaced via `LiveStateStore.setActivity()` so it
 * shows up in `/status.json` `currentActivity` — an observable signal even on a
 * headless host.
 *
 * Timers use the global clock so Vitest fake timers can drive them; the core
 * per-cycle logic is exposed as `runCycleOnce()` for deterministic tests.
 */
import type { Bot } from 'mineflayer';
import { childLogger } from '../lib/logger.js';
import type { LiveStateStore } from './state.js';
import { behaviorRegistry } from './behaviors/index.js';
import type { AFKBehavior, BehaviorContext, BotState, NeoBotConfig } from './behaviors/types.js';
import { randomInterval, weightedPick } from './behaviors/humanize.js';
import { isPlayerNearby } from './playerPresence.js';

const log = childLogger('behavior');

const PAUSED_ACTIVITY = 'paused: player nearby';
const IDLE_ACTIVITY = 'idle';
/** How often the guardian re-checks for nearby players (ms). */
const GUARDIAN_INTERVAL_MS = 500;
/**
 * Weight multiplier applied to the just-run behavior so it's less likely to
 * fire twice in a row. Modern anti-cheats (e.g. AntiAFK's Dynamic Time Warping)
 * match repetitive movement *sequences*, so varying which behavior runs — not
 * just the timing — is what actually breaks the pattern.
 */
const REPEAT_DAMPING = 0.25;

export interface BehaviorEngineOptions {
  behaviors?: AFKBehavior[];
  /** Injectable RNG in [0,1) for deterministic tests. */
  rng?: () => number;
}

interface PendingSleep {
  timer: ReturnType<typeof setTimeout>;
  resolve: () => void;
}

export class BehaviorEngine {
  private readonly behaviors: AFKBehavior[];
  private readonly rng: () => number;

  private bot: Bot | null = null;
  private running = false;
  private paused = false;
  private lastBehaviorName: string | null = null;
  private cycleTimer: ReturnType<typeof setTimeout> | null = null;
  private guardianTimer: ReturnType<typeof setInterval> | null = null;
  private readonly pendingSleeps = new Set<PendingSleep>();

  constructor(
    private readonly state: LiveStateStore,
    private readonly config: NeoBotConfig,
    opts: BehaviorEngineOptions = {},
  ) {
    this.behaviors = opts.behaviors ?? behaviorRegistry;
    this.rng = opts.rng ?? Math.random;
  }

  /** Start the engine against a freshly-spawned bot. */
  start(bot: Bot): void {
    if (this.running) this.stop();
    this.bot = bot;
    this.running = true;
    this.paused = false;
    log.info({ behaviors: this.behaviors.map((b) => b.name) }, 'Behavior engine started');

    this.guardianTimer = setInterval(() => this.checkPresence(), GUARDIAN_INTERVAL_MS);
    this.scheduleCycle();
  }

  /** Stop the engine and release all controls. */
  stop(): void {
    this.running = false;
    this.wakeAllSleeps();
    if (this.cycleTimer) {
      clearTimeout(this.cycleTimer);
      this.cycleTimer = null;
    }
    if (this.guardianTimer) {
      clearInterval(this.guardianTimer);
      this.guardianTimer = null;
    }
    if (this.bot) {
      try {
        this.bot.clearControlStates();
        this.bot.pathfinder?.stop();
      } catch {
        // bot may already be gone during teardown
      }
    }
    this.bot = null;
    this.state.setActivity(IDLE_ACTIVITY);
    log.info('Behavior engine stopped');
  }

  private scheduleCycle(): void {
    if (!this.running) return;
    const delay = randomInterval(this.config.cycle.minMs, this.config.cycle.maxMs, this.rng);
    this.cycleTimer = setTimeout(() => {
      void this.runCycle();
    }, delay);
  }

  private async runCycle(): Promise<void> {
    await this.runCycleOnce();
    this.scheduleCycle();
  }

  /**
   * Execute a single behavior cycle. Exposed for tests; also the body of the
   * scheduled loop. Returns the activity that ran (`null` when paused/idle).
   */
  async runCycleOnce(): Promise<string | null> {
    if (!this.running || !this.bot) return null;

    const state = this.buildBotState(this.bot);

    // Player-presence pause takes absolute priority (safety default).
    if (this.updatePresence(state)) {
      this.state.setActivity(PAUSED_ACTIVITY);
      return null;
    }

    const behavior = this.selectBehavior(state);
    if (!behavior) {
      this.state.setActivity(IDLE_ACTIVITY);
      return null;
    }

    this.lastBehaviorName = behavior.name;
    this.state.setActivity(behavior.name);
    const ctx = this.buildContext(this.bot, state);
    try {
      await behavior.run(ctx);
    } catch (err) {
      log.warn({ err, behavior: behavior.name }, 'Behavior threw — continuing');
    }
    return behavior.name;
  }

  /**
   * Weight-select among enabled + eligible behaviors, de-weighting the behavior
   * that just ran (anti-pattern — see {@link REPEAT_DAMPING}).
   */
  selectBehavior(state: BotState): AFKBehavior | null {
    const eligible = this.behaviors
      .filter((b) => {
        const setting = this.config.behaviors[b.name];
        return Boolean(setting?.enabled) && b.canRun(state, this.config);
      })
      .map((b) => ({ item: b, weight: this.config.behaviors[b.name]?.weight ?? b.weight }));

    // Dampen the just-run behavior only when there's an alternative to pick.
    const damped =
      eligible.length > 1
        ? eligible.map((e) =>
            e.item.name === this.lastBehaviorName
              ? { item: e.item, weight: e.weight * REPEAT_DAMPING }
              : e,
          )
        : eligible;

    return weightedPick(damped, this.rng);
  }

  /** Recompute pause flag; interrupt current activity if a player just appeared. */
  private updatePresence(state: BotState): boolean {
    const nearby = isPlayerNearby(state, this.config.playerPause.radius);
    if (nearby && !this.paused) {
      this.paused = true;
      this.interrupt();
    } else if (!nearby) {
      this.paused = false;
    }
    return this.paused;
  }

  /** Guardian tick: cheap re-check so we react between cycles too. */
  private checkPresence(): void {
    if (!this.running || !this.bot) return;
    const state = this.buildBotState(this.bot);
    const wasPaused = this.paused;
    if (this.updatePresence(state) && !wasPaused) {
      this.state.setActivity(PAUSED_ACTIVITY);
      log.info('Player nearby — pausing all activity');
    } else if (wasPaused && !this.paused) {
      log.info('Area clear — resuming activity');
    }
  }

  /** Stop any in-flight movement immediately. */
  private interrupt(): void {
    this.wakeAllSleeps();
    if (this.bot) {
      try {
        this.bot.clearControlStates();
        this.bot.pathfinder?.stop();
      } catch {
        // ignore
      }
    }
  }

  private buildContext(bot: Bot, state: BotState): BehaviorContext {
    return {
      bot,
      state,
      config: this.config,
      rng: this.rng,
      sleep: (ms) => this.abortableSleep(ms),
      shouldAbort: () => this.paused || !this.running,
    };
  }

  /** Sleep that resolves early when the engine pauses/stops. */
  private abortableSleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.paused || !this.running) {
        resolve();
        return;
      }
      const entry: PendingSleep = {
        resolve,
        timer: setTimeout(() => {
          this.pendingSleeps.delete(entry);
          resolve();
        }, ms),
      };
      this.pendingSleeps.add(entry);
    });
  }

  private wakeAllSleeps(): void {
    for (const entry of this.pendingSleeps) {
      clearTimeout(entry.timer);
      entry.resolve();
    }
    this.pendingSleeps.clear();
  }

  /** Build the read-model snapshot handed to behaviors. */
  private buildBotState(bot: Bot): BotState {
    const entity = bot.entity as { position?: { x: number; y: number; z: number }; onGround?: boolean } | undefined;
    const pos = entity?.position ?? null;
    const players = Object.values(bot.players ?? {})
      .filter((p) => p?.username)
      .map((p) => {
        const ep = p.entity?.position;
        return {
          username: p.username,
          position: ep ? { x: ep.x, y: ep.y, z: ep.z } : null,
        };
      });

    return {
      self: bot.username,
      position: pos ? { x: pos.x, y: pos.y, z: pos.z } : null,
      health: bot.health ?? 20,
      food: bot.food ?? 20,
      onGround: entity?.onGround ?? true,
      players,
    };
  }
}
