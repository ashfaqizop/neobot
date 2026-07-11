# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
