# Behavior Module Guide

NeoBot's anti-AFK activity is a **plugin system**: each behavior is an
independent module implementing a shared interface and registered in
`src/bot/behaviors/index.ts`. You can add a new behavior without touching the
engine core.

## The `AFKBehavior` contract

Defined in [`src/bot/behaviors/types.ts`](../src/bot/behaviors/types.ts):

```ts
interface AFKBehavior {
  name: string;                 // unique id; also shown as `currentActivity`
  enabledByDefault: boolean;
  weight: number;               // relative selection frequency
  canRun(state: BotState, config: NeoBotConfig): boolean;
  run(ctx: BehaviorContext): Promise<void>;
}
```

- **`canRun`** gates eligibility (e.g. only when the bot has a position, or only
  when chat is enabled). The engine never runs a behavior whose `canRun` returns
  `false` or whose config entry is disabled.
- **`run(ctx)`** performs one turn. `ctx` bundles everything you need:
  - `ctx.bot` — the live Mineflayer bot (with `pathfinder` loaded).
  - `ctx.state` — a read-only `BotState` snapshot (position, health, nearby players).
  - `ctx.config` — the resolved `NeoBotConfig`.
  - `ctx.rng()` — inject-friendly RNG in `[0,1)` (use this, not `Math.random`, so
    behavior is testable and deterministic).
  - `ctx.sleep(ms)` — an **abort-aware** delay: it resolves early when a player
    appears or the engine stops.
  - `ctx.shouldAbort()` — check this in loops and bail promptly when it's `true`.

## How the engine runs behaviors

`src/bot/behaviorEngine.ts`:

1. On a humanized random interval, it builds a fresh `BotState`.
2. **Player-presence pause is checked first** — if a real player is within
   `config.playerPause.radius`, all activity stops (always-on safety default).
3. Otherwise it weight-selects among eligible behaviors — **de-weighting the one
   that just ran** so sequences don't become repetitive (defeats pattern/DTW
   based anti-cheat).
4. It sets `currentActivity` (visible in `/status.json`) and awaits `run(ctx)`.

## Human-like movement

Use the helpers in [`humanize.ts`](../src/bot/behaviors/humanize.ts) —
`microPauseMs`, `jitter`, `smallTurn`, `randomPointInRadius`, `chance`,
`randomInt` — to layer imperfection (micro-pauses, varied speed, small look
jitter, occasional backtracking). Prefer physics-based movement (control states,
pathfinder) over teleporting: server anti-cheats like GrimAC verify movement
against a physics simulation.

## Adding a behavior — worked example

```ts
// src/bot/behaviors/sneakPeek.ts
import type { AFKBehavior } from './types.js';
import { chance, randomInt } from './humanize.js';

export const sneakPeek: AFKBehavior = {
  name: 'sneakPeek',
  enabledByDefault: true,
  weight: 1,
  canRun: (state) => state.position !== null,
  async run({ bot, rng, sleep, shouldAbort }) {
    if (shouldAbort()) return;
    bot.setControlState('sneak', true);
    await sleep(randomInt(400, 1200, rng));
    bot.setControlState('sneak', false);
    if (chance(0.5, rng) && !shouldAbort()) {
      await bot.look(bot.entity.yaw + 0.5, 0, false);
    }
  },
};
```

Then register it:

```ts
// src/bot/behaviors/index.ts
import { sneakPeek } from './sneakPeek.js';
export const behaviorRegistry: AFKBehavior[] = [walk, jumpLook, pathfindRandom, chat, sneakPeek];
```

Add a default config entry in
[`src/bot/behaviorConfig.ts`](../src/bot/behaviorConfig.ts)
(`sneakPeek: { enabled: true, weight: 1 }`) and a unit test. Done — the engine
picks it up automatically.

## Block interaction & safe zone (masterdoc §7)

The `mineBlocks` behavior is governed by `config.blockInteraction.mode`:

| Mode | Behavior |
|---|---|
| `off` (default) | No block interaction at all. |
| `self-placed-only` | Leave-no-trace: places a block then digs it back (net-zero). Only ever breaks blocks it placed. |
| `radius-any` | May break natural blocks within the safe zone. |

A separate `boundless` flag lifts the safe-zone restriction entirely (for
private/empty test servers). Targets are validated with
[`isWithinSafeZone`](../src/bot/safeZone.ts); "never dig" blocks (bedrock,
liquids, spawners, …) live in `UNMINEABLE` in
[`blockInteraction.ts`](../src/bot/blockInteraction.ts).

## Hazards (masterdoc §6)

Hazard self-preservation runs on a fast guardian that **outranks all behaviors
and the player-presence pause**. [`classifyHazard`](../src/bot/hazards.ts)
prioritizes `lava > drowning > hostile > fall`; while a hazard is active,
`currentActivity` shows `hazard: <type>` and behaviors are suspended until it
clears. Toggle with `HAZARD_AVOIDANCE_ENABLED` (on by default).

## Checklist

- [ ] Implements `AFKBehavior` with a unique `name`.
- [ ] Uses `ctx.rng`, `ctx.sleep`, and `ctx.shouldAbort` (no raw `Math.random`/`setTimeout`).
- [ ] Registered in `behaviors/index.ts` and given a config default.
- [ ] Has a unit test.
