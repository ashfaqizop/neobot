/**
 * Hazard self-preservation (masterdoc §6).
 *
 * Basic, always-on survival reflexes that take priority over cosmetic activity:
 * escape lava, surface before drowning, flee hostile mobs, and don't walk off
 * ledges. The classification is a pure function (unit-tested); reading the live
 * bot and acting are separated out.
 */
import type { Bot } from 'mineflayer';
import { childLogger } from '../lib/logger.js';

const log = childLogger('hazards');

export type HazardType = 'lava' | 'drowning' | 'fall' | 'hostile';

/** Oxygen at or below this (out of 20) counts as drowning risk. */
export const LOW_OXYGEN = 6;
/** Hostile mobs within this many blocks trigger a flee. */
export const HOSTILE_RADIUS = 8;
/** A drop of more than this many blocks ahead counts as a fall edge. */
export const FALL_DROP = 3;

/** The minimal facts needed to classify the current hazard. */
export interface HazardSnapshot {
  isInLava: boolean;
  lavaAdjacent: boolean;
  isInWater: boolean;
  oxygen: number;
  hostileNearby: boolean;
  edgeAhead: boolean;
}

/**
 * Classify the most urgent active hazard, in strict priority order:
 * lava > drowning > hostile > fall. Returns null when safe. Pure.
 */
export function classifyHazard(s: HazardSnapshot): HazardType | null {
  if (s.isInLava || s.lavaAdjacent) return 'lava';
  if (s.isInWater && s.oxygen <= LOW_OXYGEN) return 'drowning';
  if (s.hostileNearby) return 'hostile';
  if (s.edgeAhead) return 'fall';
  return null;
}

/** True for entities that are hostile mobs (version-tolerant). */
export function isHostileEntity(entity: { kind?: string; type?: string; mobType?: string }): boolean {
  const kind = entity.kind ?? '';
  return /hostile/i.test(kind);
}

interface Vec3Like {
  x: number;
  y: number;
  z: number;
  offset(dx: number, dy: number, dz: number): Vec3Like;
  distanceTo(other: Vec3Like): number;
}

interface HazardBot {
  entity?: {
    position: Vec3Like;
    yaw: number;
    isInWater?: boolean;
    isInLava?: boolean;
    onGround?: boolean;
  };
  oxygenLevel?: number;
  blockAt(point: Vec3Like): { name?: string } | null;
  nearestEntity(match: (e: { kind?: string }) => boolean): { position: Vec3Like } | null;
}

function blockNameAt(bot: HazardBot, pos: Vec3Like): string {
  return bot.blockAt(pos)?.name ?? '';
}

/** Read the live bot into a {@link HazardSnapshot}. */
export function buildHazardSnapshot(bot: Bot): HazardSnapshot {
  const b = bot as unknown as HazardBot;
  const entity = b.entity;
  if (!entity) {
    return {
      isInLava: false,
      lavaAdjacent: false,
      isInWater: false,
      oxygen: 20,
      hostileNearby: false,
      edgeAhead: false,
    };
  }

  const pos = entity.position;
  const isInLava = entity.isInLava ?? false;
  const isInWater = entity.isInWater ?? false;

  // Lava in any of the immediately-adjacent cells around the feet.
  let lavaAdjacent = false;
  const offsets: [number, number, number][] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
    [0, -1, 0],
  ];
  for (const [dx, dy, dz] of offsets) {
    if (/lava/i.test(blockNameAt(b, pos.offset(dx, dy, dz)))) {
      lavaAdjacent = true;
      break;
    }
  }

  const hostile = b.nearestEntity((e) => isHostileEntity(e));
  const hostileNearby = hostile !== null && hostile.position.distanceTo(pos) <= HOSTILE_RADIUS;

  // Fall edge: only while on the ground, look two blocks ahead and check for a
  // drop deeper than FALL_DROP with no support.
  let edgeAhead = false;
  if (entity.onGround) {
    const ahead = pos.offset(-Math.sin(entity.yaw) * 2, 0, -Math.cos(entity.yaw) * 2);
    const groundAhead = blockNameAt(b, ahead.offset(0, -1, 0));
    if (groundAhead === 'air' || groundAhead === '') {
      let solidFound = false;
      for (let d = 2; d <= FALL_DROP + 1; d++) {
        const below = blockNameAt(b, ahead.offset(0, -d, 0));
        if (below !== 'air' && below !== '') {
          solidFound = true;
          break;
        }
      }
      edgeAhead = !solidFound;
    }
  }

  return {
    isInLava,
    lavaAdjacent,
    isInWater,
    oxygen: b.oxygenLevel ?? 20,
    hostileNearby,
    edgeAhead,
  };
}

/**
 * Take protective action for an active hazard. Called repeatedly by the engine's
 * hazard guardian while the hazard persists; the engine clears controls when the
 * hazard resolves.
 */
export function respondToHazard(bot: Bot, type: HazardType): void {
  const b = bot as unknown as HazardBot & {
    clearControlStates(): void;
    setControlState(c: string, s: boolean): void;
    look(yaw: number, pitch: number, force?: boolean): Promise<void>;
    pathfinder?: { stop(): void };
  };
  try {
    switch (type) {
      case 'lava': {
        b.pathfinder?.stop();
        b.clearControlStates();
        // Back away from the heat.
        b.setControlState('back', true);
        b.setControlState('jump', true);
        break;
      }
      case 'drowning': {
        // Rise to the surface for air.
        b.setControlState('jump', true);
        if (b.entity) void b.look(b.entity.yaw, -Math.PI / 2, true);
        break;
      }
      case 'hostile': {
        // Face away from the nearest hostile and run.
        const entity = b.entity;
        const mob = b.nearestEntity((e) => isHostileEntity(e));
        if (entity && mob) {
          const dx = entity.position.x - mob.position.x;
          const dz = entity.position.z - mob.position.z;
          const awayYaw = Math.atan2(-dx, -dz);
          void b.look(awayYaw, 0, true);
        }
        b.clearControlStates();
        b.setControlState('forward', true);
        b.setControlState('sprint', true);
        break;
      }
      case 'fall': {
        b.pathfinder?.stop();
        b.clearControlStates();
        break;
      }
    }
  } catch (err) {
    log.warn({ err, hazard: type }, 'Hazard response failed');
  }
}
