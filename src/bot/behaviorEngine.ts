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
import type {
  AFKBehavior,
  BehaviorContext,
  BotState,
  InventoryInfo,
  NearbyInfo,
  NeoBotConfig,
} from './behaviors/types.js';
import { randomInterval, weightedPick } from './behaviors/humanize.js';
import { isPlayerNearby } from './playerPresence.js';
import { buildHazardSnapshot, classifyHazard, respondToHazard, type HazardType } from './hazards.js';

const log = childLogger('behavior');

const PAUSED_ACTIVITY = 'paused: player nearby';
const IDLE_ACTIVITY = 'idle';
/** How often the guardian re-checks for nearby players (ms). */
const GUARDIAN_INTERVAL_MS = 500;
/** Faster tick for hazard self-preservation (masterdoc §6) — safety-critical. */
const HAZARD_INTERVAL_MS = 250;

/** Loosely-typed view of the live bot for the per-cycle world scan. */
interface ScanBot {
  username?: string;
  health?: number;
  food?: number;
  oxygenLevel?: number;
  version?: string;
  time?: { isDay?: boolean };
  entity?: {
    position?: { x: number; y: number; z: number; distanceTo(o: { x: number; y: number; z: number }): number };
    onGround?: boolean;
    isInWater?: boolean;
    isInLava?: boolean;
  };
  players?: Record<string, { username?: string; entity?: { position?: { x: number; y: number; z: number } } }>;
  registry?: { foodsByName?: Record<string, unknown> };
  inventory?: { items(): { name: string; count: number }[] };
  isABed?: (block: { name: string }) => boolean;
  findBlock?: (opts: { matching: (b: { name: string }) => boolean; maxDistance: number }) => unknown;
  nearestEntity?: (
    match: (e: { name?: string; type?: string }) => boolean,
  ) => { type?: string; position?: { distanceTo(o: unknown): number } } | null;
}
/**
 * Weight multiplier applied to the just-run behavior so it's less likely to
 * fire twice in a row. Modern anti-cheats (e.g. AntiAFK's Dynamic Time Warping)
 * match repetitive movement *sequences*, so varying which behavior runs — not
 * just the timing — is what actually breaks the pattern.
 */
const REPEAT_DAMPING = 0.25;

/**
 * Safe Mode dial-back (masterdoc §6.3). When anti-cheat pressure is detected we
 * restrict activity to these low-movement behaviors and stretch the cycle timing,
 * cutting the movement complexity/frequency that pattern-based anti-cheats match.
 */
const SAFE_BEHAVIORS = new Set(['lookAtEntity', 'jumpLook', 'sneak', 'eat', 'sleep']);
const SAFE_MODE_CYCLE_FACTOR = 2.5;

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
  private manualPaused = false;
  private safeMode = false;
  private hazard: HazardType | null = null;
  private lastBehaviorName: string | null = null;
  private cycleTimer: ReturnType<typeof setTimeout> | null = null;
  private guardianTimer: ReturnType<typeof setInterval> | null = null;
  private hazardTimer: ReturnType<typeof setInterval> | null = null;
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
    this.hazard = null;
    // Preserve manualPaused across reconnects so an operator "pause" sticks.
    log.info({ behaviors: this.behaviors.map((b) => b.name) }, 'Behavior engine started');

    this.guardianTimer = setInterval(() => this.checkPresence(), GUARDIAN_INTERVAL_MS);
    if (this.config.hazards.enabled) {
      this.hazardTimer = setInterval(() => this.checkHazardsOnce(), HAZARD_INTERVAL_MS);
    }
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
    if (this.hazardTimer) {
      clearInterval(this.hazardTimer);
      this.hazardTimer = null;
    }
    this.hazard = null;
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
    const base = randomInterval(this.config.cycle.minMs, this.config.cycle.maxMs, this.rng);
    const delay = this.safeMode ? base * SAFE_MODE_CYCLE_FACTOR : base;
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

    // Hazard self-preservation outranks everything (masterdoc §6).
    if (this.hazard) {
      this.state.setActivity(`hazard: ${this.hazard}`);
      return null;
    }

    // Manual pause (dashboard/Discord control) suspends all behaviors.
    if (this.manualPaused) {
      this.state.setActivity('paused: manual');
      return null;
    }

    const state = this.buildBotState(this.bot);

    // Player-presence pause takes priority over normal behaviors (safety default).
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
        // Safe Mode restricts to the low-movement allow-list (§6.3 dial-back).
        if (this.safeMode && !SAFE_BEHAVIORS.has(b.name)) return false;
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

  /**
   * Hazard guardian tick (masterdoc §6). Detects and responds to lava/drowning/
   * hostile/fall danger with priority over all other activity. Exposed for tests.
   * Returns the active hazard type (or null).
   */
  checkHazardsOnce(): HazardType | null {
    if (!this.running || !this.bot || !this.config.hazards.enabled) return null;

    const hazard = classifyHazard(buildHazardSnapshot(this.bot));
    if (hazard) {
      if (this.hazard !== hazard) {
        this.hazard = hazard;
        this.wakeAllSleeps();
        this.state.setActivity(`hazard: ${hazard}`);
        log.warn({ hazard }, 'Hazard detected — self-preservation engaged');
      }
      respondToHazard(this.bot, hazard);
    } else if (this.hazard) {
      this.hazard = null;
      try {
        this.bot.clearControlStates();
      } catch {
        // bot gone
      }
      log.info('Hazard cleared — resuming activity');
    }
    return this.hazard;
  }

  /** Guardian tick: cheap re-check so we react between cycles too. */
  private checkPresence(): void {
    if (!this.running || !this.bot) return;
    const state = this.buildBotState(this.bot);
    // Feed the dashboard minimap + player-count widget (§8.4). Silent setter —
    // the store doesn't emit on this, so the 500ms cadence costs nothing.
    this.state.setWorld({ position: state.position, playerCount: state.players.length });
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
      shouldAbort: () => this.paused || this.manualPaused || this.hazard !== null || !this.running,
    };
  }

  /** Manually pause/resume all behaviors (dashboard/Discord control, §11). */
  setManualPause(paused: boolean): void {
    this.manualPaused = paused;
    if (paused) {
      this.interrupt();
      this.state.setActivity('paused: manual');
      log.info('Behaviors manually paused');
    } else {
      log.info('Behaviors resumed');
    }
  }

  isManuallyPaused(): boolean {
    return this.manualPaused;
  }

  /**
   * Dial movement complexity down (Safe Mode, masterdoc §6.3). While on, only the
   * low-movement {@link SAFE_BEHAVIORS} run and cycles are stretched. Sticky
   * across reconnects, like manual pause.
   */
  setSafeMode(on: boolean): void {
    if (this.safeMode === on) return;
    this.safeMode = on;
    log.info({ safeMode: on }, on ? 'Safe Mode engaged — dialing back activity' : 'Safe Mode lifted');
  }

  isSafeMode(): boolean {
    return this.safeMode;
  }

  /** Sleep that resolves early when the engine pauses/stops. */
  private abortableSleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.paused || this.manualPaused || this.hazard !== null || !this.running) {
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

  /** Build the read-model snapshot handed to behaviors. Defensive: any missing
   * bot capability degrades to a safe default rather than throwing. */
  private buildBotState(bot: Bot): BotState {
    const b = bot as unknown as ScanBot;
    const entity = b.entity;
    const pos = entity?.position ?? null;
    const players = Object.values(b.players ?? {})
      .filter((p) => p?.username)
      .map((p) => {
        const ep = p.entity?.position;
        return {
          username: p.username as string,
          position: ep ? { x: ep.x, y: ep.y, z: ep.z } : null,
        };
      });

    return {
      self: b.username ?? 'NeoBot',
      position: pos ? { x: pos.x, y: pos.y, z: pos.z } : null,
      health: b.health ?? 20,
      food: b.food ?? 20,
      oxygen: b.oxygenLevel ?? 20,
      onGround: entity?.onGround ?? true,
      isInWater: entity?.isInWater ?? false,
      isInLava: entity?.isInLava ?? false,
      isDay: b.time?.isDay ?? true,
      inventory: this.readInventory(b),
      nearby: this.readNearby(b),
      players,
    };
  }

  private readInventory(b: ScanBot): InventoryInfo {
    let items: { name: string; count: number }[] = [];
    try {
      items = b.inventory?.items() ?? [];
    } catch {
      items = [];
    }
    const foods = b.registry?.foodsByName;
    return {
      hasFood: foods ? items.some((it) => it.name in foods) : false,
      hasFishingRod: items.some((it) => it.name.includes('fishing_rod')),
      tossableItemCount: items.filter((it) => it.count > 1).length,
    };
  }

  private readNearby(b: ScanBot): NearbyInfo {
    const block = (matching: (bl: { name: string }) => boolean, maxDistance: number): boolean => {
      try {
        return b.findBlock?.({ matching, maxDistance }) != null;
      } catch {
        return false;
      }
    };
    const entityNear = (match: (e: { name?: string; type?: string }) => boolean, radius: number): boolean => {
      try {
        const e = b.nearestEntity?.(match);
        const self = b.entity?.position;
        if (!e?.position || !self) return false;
        return e.position.distanceTo(self) <= radius;
      } catch {
        return false;
      }
    };

    return {
      water: block((bl) => bl.name === 'water', 12),
      bed: block((bl) => (b.isABed ? b.isABed(bl) : /_bed$/.test(bl.name)), 8),
      door: block((bl) => /(_door|_fence_gate|_trapdoor)$/.test(bl.name), 6),
      boat: entityNear((e) => (e.name ?? '').includes('boat'), 6),
      entity: entityNear((e) => e.type === 'mob', 8),
    };
  }
}
