/**
 * Human-like movement imperfection layer (masterdoc §7).
 *
 * Movement is deliberately NOT perfect goal-completion. These helpers layer
 * randomized imperfection — micro-pauses, jitter, varied speed, non-uniform
 * timing — on top of behaviors specifically to defeat pattern-based anti-cheat
 * movement analysis (Vulcan/Grim/NCP-style), not merely to look "busy".
 *
 * Every function takes an injectable RNG (`rng: () => number` in [0,1)) so the
 * logic is fully deterministic and unit-testable.
 */
import type { Point } from './types.js';

type Rng = () => number;

/** Random integer in [min, max] (inclusive). */
export function randomInt(min: number, max: number, rng: Rng = Math.random): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Random delay (ms) in [min, max] — used for non-uniform cycle timing. */
export function randomInterval(min: number, max: number, rng: Rng = Math.random): number {
  return randomInt(min, max, rng);
}

/** A symmetric random offset in [-magnitude, +magnitude]. */
export function jitter(magnitude: number, rng: Rng = Math.random): number {
  return (rng() * 2 - 1) * magnitude;
}

/** Returns true with probability `p` (0..1). */
export function chance(p: number, rng: Rng = Math.random): boolean {
  return rng() < p;
}

/** A short randomized pause duration (ms) to break up robotic cadence. */
export function microPauseMs(rng: Rng = Math.random): number {
  return randomInt(80, 650, rng);
}

/** Small random look delta (radians) for idle glancing / movement jitter. */
export function randomLookOffset(rng: Rng = Math.random): { yaw: number; pitch: number } {
  return {
    yaw: jitter(Math.PI, rng), // anywhere around, but usually combined with small turns
    pitch: jitter(0.35, rng), // keep pitch modest so it looks natural
  };
}

/** A small random yaw turn (radians) for organic walking direction changes. */
export function smallTurn(rng: Rng = Math.random): number {
  return jitter(Math.PI / 3, rng); // up to ±60°
}

/**
 * A random point on the XZ plane within `radius` of an anchor. Uses a uniform
 * disc distribution (sqrt) so points aren't biased toward the center.
 */
export function randomPointInRadius(
  anchorX: number,
  anchorZ: number,
  radius: number,
  rng: Rng = Math.random,
): { x: number; z: number } {
  const angle = rng() * 2 * Math.PI;
  const dist = Math.sqrt(rng()) * radius;
  return {
    x: Math.round(anchorX + Math.cos(angle) * dist),
    z: Math.round(anchorZ + Math.sin(angle) * dist),
  };
}

/** Euclidean 3D distance between two points. */
export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export interface Weighted<T> {
  item: T;
  weight: number;
}

/**
 * Weighted random selection. Returns null if the list is empty or all weights
 * are non-positive.
 */
export function weightedPick<T>(items: Weighted<T>[], rng: Rng = Math.random): T | null {
  const positive = items.filter((w) => w.weight > 0);
  if (positive.length === 0) return null;

  const total = positive.reduce((sum, w) => sum + w.weight, 0);
  let roll = rng() * total;
  for (const w of positive) {
    roll -= w.weight;
    if (roll < 0) return w.item;
  }
  // Floating-point fallthrough safety.
  return positive[positive.length - 1]!.item;
}
