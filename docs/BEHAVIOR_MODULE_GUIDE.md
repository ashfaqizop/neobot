# Behavior Module Guide

> **Status:** stub — expanded in Phase 3, when the behavior engine lands.

NeoBot's anti-AFK activity is a plugin system: each behavior is an independent
module implementing a shared interface and registered in
`src/bot/behaviors/index.ts`. Contributors can add new behaviors without
touching core logic.

## The interface (target)

```ts
interface AFKBehavior {
  name: string;
  enabledByDefault: boolean;
  weight: number; // relative selection frequency
  canRun(botState: BotState, config: NeoBotConfig): boolean;
  run(bot: Bot, botState: BotState): Promise<void>;
}
```

## Adding a behavior (target flow)

1. Create `src/bot/behaviors/myBehavior.ts` implementing `AFKBehavior`.
2. Register it in `src/bot/behaviors/index.ts`.
3. Add a unit test.
4. Document its config knobs.

A full walkthrough with a worked example arrives with Phase 3.
