# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Phase 4 — Extended behaviors + hazards.** Completes the v1 behavior set:
  - Ten new behaviors: `sneak`, `swim`, `eat`, `fish`, `sleep`, `doors`, `boat`,
    `lookAtEntity`, `itemDropPickup`, and `mineBlocks` — each self-gating via an
    enriched `BotState` read-model.
  - **Block-interaction modes** (`src/bot/blockInteraction.ts`, masterdoc §7):
    `off` (default, leave-no-trace), `self-placed-only` (net-zero place→dig), and
    `radius-any`, plus a `boundless` escape hatch; enforced by a pure
    `src/bot/safeZone.ts` helper.
  - **Hazard self-preservation** (`src/bot/hazards.ts`, masterdoc §6): lava,
    drowning, hostile-mob, and fall-edge detection with a priority classifier and
    protective responses, wired as a fast engine guardian that outranks
    player-presence and all behaviors.
  - Enriched `buildBotState` (oxygen/water/lava/day + inventory + nearby scans)
    and new `hazard: <type>` activity surfaced in `/status.json`.
  - New env: `BLOCK_INTERACTION_MODE`, `BLOCK_INTERACTION_BOUNDLESS`,
    `HAZARD_AVOIDANCE_ENABLED`.

- **Phase 3 — Behavior engine core.** Pluggable anti-AFK activity:
  - `AFKBehavior` plugin contract + registry (`src/bot/behaviors/`), so new
    behaviors register without touching core logic.
  - Behaviors: `walk` (organic control-state walking), `jumpLook`,
    `pathfindRandom` (pathfinder to a random point in the safe-zone), and `chat`
    (off by default).
  - Human-like movement imperfection layer (`humanize.ts`): micro-pauses,
    jitter, varied speed, weighted selection, random reachable points.
  - `BehaviorEngine` scheduler with humanized cycle timing and anti-repeat
    behavior selection (breaks the movement *sequences* modern anti-cheats
    match, not just timing).
  - **Always-on player-presence pause** (`playerPresence.ts`): when a real
    player enters the configured radius, all activity stops and resumes when
    clear — a safety default, not a toggle.
  - Current behavior surfaces as `/status.json` `currentActivity`.
  - New env: `PLAYER_PROXIMITY_RADIUS`, `CHAT_ENABLED`, `CHAT_MESSAGES`.
  - Fleshed-out `docs/BEHAVIOR_MODULE_GUIDE.md` with the real contract + example.

- **Phase 2 — Core connection MVP.** The deployable keep-alive:
  - `ConnectionManager` (`src/bot/connection.ts`): connects one Mineflayer bot
    (offline auth, auto version detection with fail-fast on unsupported), with
    exponential-backoff reconnect, a configurable max-retry limit, and typed
    alert / anti-cheat hooks for Phases 8–9.
  - Disconnect/kick-reason classifier (`src/bot/kickReasons.ts`) implementing the
    masterdoc §6 table (AFK / banned / whitelist / restart / full / anti-cheat /
    network / unknown → retry strategy).
  - In-memory live-state store (`src/bot/state.ts`, `EventEmitter`) tracking
    status, sessions, uptime %, and reconnect history.
  - Minimal Express server (`src/server/app.ts`) exposing the public, no-auth
    `GET /status.json` (UptimeRobot keep-alive target) and `GET /healthz`.
  - Resilience: the process survives late dependency errors (no-op absorber on
    discarded bots + `uncaughtException`/`unhandledRejection` guards) and boots
    fine with zero credentials (`not-configured` status).
  - Tests: kick-reason classification, backoff, live-state/uptime, status routes
    (supertest), and connection lifecycle (injected fake bot).

- **Phase 1 — Scaffolding.** Project skeleton and toolchain:
  - TypeScript (strict) project targeting Node 22, with `tsconfig` build config.
  - ESLint 9 (flat, type-checked) + Prettier + `.editorconfig`.
  - Vitest test runner with a smoke test.
  - Foundational modules: validated environment resolution (`src/config/env.ts`)
    and structured `pino` logging (`src/lib/logger.ts`).
  - Minimal bootstrap entrypoint (`src/index.ts`).
  - Multi-stage `Dockerfile` (non-root) and `docker-compose.yml`.
  - GitHub Actions CI: lint + typecheck + test + build, and a Docker build check.
  - Open-source hygiene: MIT `LICENSE`, `README`, `CONTRIBUTING`,
    `CODE_OF_CONDUCT`, `SECURITY`, issue/PR templates, and Dependabot.
  - `.env.example` documenting all configuration.
