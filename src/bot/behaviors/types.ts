/**
 * Behavior engine contracts (masterdoc §7).
 *
 * The `AFKBehavior` interface is the pluggable seam: each behavior is an
 * independent module implementing it and registered in `index.ts`, so
 * contributors add new behaviors without touching core logic.
 */
import type { Bot } from 'mineflayer';

/** A minimal 3D point (structurally satisfied by prismarine's `Vec3`). */
export interface Point {
  x: number;
  y: number;
  z: number;
}

/** Another player observed near the bot. */
export interface PlayerInfo {
  username: string;
  position: Point | null;
}

/** Coarse inventory flags behaviors gate on (masterdoc §7). */
export interface InventoryInfo {
  hasFood: boolean;
  hasFishingRod: boolean;
  /** Number of items that could be tossed then re-collected (net-zero). */
  tossableItemCount: number;
}

/** Cheap "is X within reach" flags computed once per cycle. */
export interface NearbyInfo {
  water: boolean;
  bed: boolean;
  door: boolean;
  boat: boolean;
  /** Any non-player entity (mob) nearby — for look-at behavior. */
  entity: boolean;
}

/**
 * A read-only snapshot of the bot/world the engine builds each cycle and hands
 * to behaviors. Behaviors read this; they act through the live `bot`.
 */
export interface BotState {
  /** The bot's own username (to exclude itself from player-presence checks). */
  self: string;
  position: Point | null;
  health: number;
  food: number;
  /** Air remaining [0–20]; 20 when not submerged. */
  oxygen: number;
  onGround: boolean;
  isInWater: boolean;
  isInLava: boolean;
  isDay: boolean;
  inventory: InventoryInfo;
  nearby: NearbyInfo;
  /** All other players the bot can see (self already excluded). */
  players: PlayerInfo[];
}

/** Per-behavior toggle + relative selection weight (masterdoc §7). */
export interface BehaviorSetting {
  enabled: boolean;
  weight: number;
}

/** Chat behavior config — off by default (masterdoc §7). */
export interface ChatConfig {
  enabled: boolean;
  messages: string[];
  minIntervalMs: number;
  maxIntervalMs: number;
}

/** Always-on player-presence pause radius (masterdoc §7 safety default). */
export interface PlayerPauseConfig {
  radius: number;
}

/** Safe-zone anchor + roam radius (masterdoc §7). */
export interface SafeZoneConfig {
  x: number | null;
  y: number | null;
  z: number | null;
  radius: number;
}

/** Block-interaction ("mining") mode (masterdoc §7). */
export type BlockInteractionMode = 'off' | 'self-placed-only' | 'radius-any';

export interface BlockInteractionConfig {
  mode: BlockInteractionMode;
  /** Unrestricted roam/interaction for private/empty test servers. */
  boundless: boolean;
}

/** Hazard self-preservation toggle (masterdoc §6). */
export interface HazardsConfig {
  enabled: boolean;
}

/** Resolved runtime configuration for the behavior engine. */
export interface NeoBotConfig {
  behaviors: Record<string, BehaviorSetting>;
  chat: ChatConfig;
  playerPause: PlayerPauseConfig;
  safeZone: SafeZoneConfig;
  blockInteraction: BlockInteractionConfig;
  hazards: HazardsConfig;
  /** Humanized delay between behavior cycles. */
  cycle: { minMs: number; maxMs: number };
}

/**
 * Everything a behavior needs to run one turn. Bundles the live bot, the
 * read-model, config, an injectable RNG, and cooperative-cancellation helpers
 * (`sleep`/`shouldAbort`) so behaviors yield promptly when a player appears or
 * the engine stops.
 */
export interface BehaviorContext {
  bot: Bot;
  state: BotState;
  config: NeoBotConfig;
  /** Injectable RNG in [0,1) — deterministic in tests. */
  rng: () => number;
  /** Abort-aware sleep: resolves early if `shouldAbort()` becomes true. */
  sleep: (ms: number) => Promise<void>;
  /** True when the current behavior should stop ASAP (player nearby / stopping). */
  shouldAbort: () => boolean;
}

/**
 * A pluggable anti-AFK behavior (masterdoc §7). `canRun` gates eligibility;
 * the engine weight-selects among eligible behaviors and invokes `run`.
 */
export interface AFKBehavior {
  /** Unique, stable identifier (also shown as `currentActivity`). */
  name: string;
  enabledByDefault: boolean;
  /** Relative selection frequency among eligible behaviors. */
  weight: number;
  canRun(state: BotState, config: NeoBotConfig): boolean;
  run(ctx: BehaviorContext): Promise<void>;
}
