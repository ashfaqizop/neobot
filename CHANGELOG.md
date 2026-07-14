# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Phase 10 — Docs & release automation.** Made NeoBot deployable and releasable
  by others (masterdoc §18.10):
  - **Deploy to Render.** A `render.yaml` Blueprint (`runtime: docker`,
    `plan: free`, `autoDeployTrigger: off`, `healthCheckPath: /healthz`,
    `SESSION_SECRET` generated + `sync: false` placeholders for the rest) and a
    one-click **Deploy to Render** button in the README.
  - **Semver release workflow** (`.github/workflows/release.yml`): pushing a
    `v*.*.*` tag builds, tests, and publishes a GitHub Release with notes
    extracted from the CHANGELOG (`scripts/extract-changelog.mjs`). The Docker
    image stays build-only (not published).
  - **Real architecture & deployment docs** — `docs/ARCHITECTURE.md` and the
    Render section of `docs/DEPLOYMENT.md` promoted from stubs; a "Releasing"
    guide in `CONTRIBUTING.md`; a live CI status badge in the README.
  - Bumped `actions/checkout` and `actions/setup-node` to v5 (Node 24), clearing
    the runner deprecation warning.

- **Phase 9 — Resource management, Safe Mode & hibernation.** The resilience
  layer for unattended runs on a 512 MB free tier (masterdoc §12, §6.3, §10):
  - **Memory watchdog** (`src/watchdog/memoryWatchdog.ts`): polls process RSS and,
    on crossing a threshold, recovers in tiers — restart the connection subsystem
    first (cheap, + a GC nudge), then restart the whole process if memory hasn't
    recovered after a grace period (host manager brings it back). Emits
    `low_memory` alerts. `NODE_OPTIONS=--max-old-space-size=400` in the Docker
    runtime.
  - **Safe Mode auto dial-back** (`src/bot/safeMode.ts` + engine): repeated
    anti-cheat kicks within a window auto-engage Safe Mode, which restricts the
    behavior engine to a low-movement allow-list and stretches cycle timing
    (§6.3). On by default, toggleable (`SAFE_MODE_AUTO` / dashboard). Wires the
    long-standing `BotController.setSafeMode` flag to real behavior.
  - **Aternos-style hibernation detection** (`src/bot/hibernation.ts` +
    `kickReasons.ts`): "server starting / in queue / offline" disconnects are
    detected and polled on a steady interval as a new `hibernating-wait` status —
    without counting against the max-retry budget — instead of failing.
  - **Self-ping fallback** (`src/watchdog/selfPing.ts`): optional internal ping of
    `/status.json` (default OFF; guards AFK only, cannot revive a slept host).
  - Process guards now emit a `crash` alert on recovered uncaught errors, lighting
    up the last of the Phase 8 alert keys.
  - New env: `MEMORY_THRESHOLD_MB`, `MEMORY_CHECK_INTERVAL_MS`, `MEMORY_GRACE_MS`,
    `SAFE_MODE_AUTO`, `SELF_PING_INTERVAL_MS`.

- **Phase 8 — Discord bot.** An optional, toggleable `discord.js` bot for remote
  control and alerts (masterdoc §11), gated by `hasDiscord()` — with no token it
  never starts, and any Discord failure is swallowed so the keep-alive daemon
  stays up:
  - **Slash commands** (`src/discord/commands.ts`): `/status`, `/pause`,
    `/resume`, `/restart`, `/reconnect`, `/safe-mode <on|off>`, `/logs [lines]`,
    `/config`, and `/alerts <view|mute|unmute>` — routed to the shared
    `BotController` / repositories. Guild-scoped, non-privileged `Guilds` intent.
    Open to anyone in the guild in v1 (documented limitation).
  - **Per-event push alerts** (`src/discord/alerts.ts`): a `DiscordAlerter` fans
    connection/system events out to a channel, gated by the `alert_settings`
    toggles (default all-on). Channel = `DISCORD_ALERT_CHANNEL_ID` or the guild's
    system / first sendable channel. The connection manager now also emits a
    `connected` alert.
  - **Alert toggles on two surfaces:** a new `GET/PUT /api/alerts` and a
    dashboard **Discord alerts** panel, mirroring the `/alerts` Discord command.
  - New env: `DISCORD_ALERT_CHANNEL_ID` (optional).

- **Phase 7 — Dashboard frontend.** The React dashboard SPA (`web/`), served by
  the same Express process (one port, one deployable):
  - **Stack:** Vite 7 + React 19 + TypeScript + Tailwind CSS v4 (CSS-first
    `@theme` tokens), `react-router` v7, and the Socket.IO client. Added as an
    npm workspace; fonts self-hosted via `@fontsource` (no CDN → CSP-clean).
  - **Ultra-polished black + electric-cyan theme** (masterdoc §8.1/§19),
    dark-only, data-dense, mobile-responsive, with a consistent design-token
    system and `prefers-reduced-motion` fallbacks throughout.
  - **Pages:** Login (with lockout messaging + token-URL deep links), the
    first-run **Setup Wizard**, a live **Dashboard** (status/uptime/activity/RAM/
    player-count/reconnect history, pause·resume·restart·reconnect·Safe-Mode
    controls, and a 2D **minimap** plotting X/Z with a movement trail), **Logs**
    (event tail + session history, timezone-localized), and **Config** (edit +
    JSON export/import).
  - Served by Express: `web/dist` static assets + SPA fallback, mounted after
    `/api`, `/status.json`, and `/socket.io` so those are never shadowed.
  - **Live data:** `LiveStateStore.setWorld()` now surfaces the bot's live
    position + visible player count into the authed `GET /api/state` snapshot
    (kept out of the public `/status.json`) to drive the minimap and widgets.
  - **Design QA (impeccable critique, 32/40 → refined):** humanized leaked
    backend identifiers (`server_restart` → "Server restart", `jumpLook` →
    "Jump & look", error codes → sentences); keyboard shortcuts (`g d`/`g l`/
    `g c` nav, `p` pause/resume, `r` reconnect, `?` help sheet); a two-step
    confirm on Restart; loading skeletons instead of spinners; an AA-contrast
    bump on the muted status tone; and the real app version in place of a
    hard-coded string.

- **Phase 6 — Dashboard backend.** The full server-side API for the dashboard
  (the React UI arrives in Phase 7):
  - **Three toggleable auth layers** (§8.2): login/password baseline (bcrypt
    admin in `admin_users`, `node:crypto` HMAC session cookies), optional
    token-URL, optional IP allowlist — composed as
    `(session OR token) AND (allowlist ok)` in `src/server/auth/`.
  - **Rate limiting + lockout** on login and `/api/*` (`express-rate-limit`).
  - **First-run setup wizard** (`src/server/setupWizard.ts`): creates the admin
    and writes `AppConfig`; secrets stay env-only (it reports Supabase/Discord
    env status). `AppConfig.auth` added.
  - **Control API** via a reusable `BotController` (`src/bot/controller.ts`):
    pause/resume/restart/reconnect/safe-mode — plus `ConnectionManager.restart()`
    /`reconnectNow()` and `BehaviorEngine.setManualPause()`.
  - **Socket.IO** live bridge (`src/server/socket.ts`) with handshake auth,
    emitting live state to authed clients.
  - `/api/*` routes: auth, setup, dashboard state (incl. RAM)/logs/sessions,
    config get/put/export/import (§8.5), control.
  - New env: `SESSION_SECRET`.

- **Phase 5 — Persistence layer.** Supabase (Postgres) as the durable source of
  truth, with an in-memory fallback so the app still boots with zero credentials:
  - Six repositories (`config`, `live_state`, `events`, `sessions`,
    `admin_users`, `alert_settings`) behind interfaces, each with a Supabase and
    an in-memory implementation, selected by `hasSupabase()` (`src/db/`).
  - **Hybrid bootstrap-then-source-of-truth** config flow (`getOrBootstrap`): env
    seeds the `config` table on first run, then Supabase governs.
  - Live-state + session mirroring (`src/db/statePersistence.ts`) via the
    `LiveStateStore` event stream (debounced `live_state` upserts + `sessions`
    rows), and `LiveStateStore.hydrate()` to restore status/uptime after a
    restart.
  - Persisted `AppConfig` (`src/config/appConfig.ts`) bundling connection +
    behavior config; secrets stay env-only.
  - `src/db/schema.sql` (the six §9 tables) and a Supabase setup guide in
    `docs/DEPLOYMENT.md`.

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
