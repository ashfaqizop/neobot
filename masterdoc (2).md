# NeoBot — Masterdoc

**A Mineflayer-based anti-AFK bot that keeps a Minecraft server alive from sleeping/idling, deployed as a self-hostable, open-source, one-click template.**

This document is the single source of truth for building NeoBot. It is written for Claude Code to implement from. Where a decision was made during discovery, it is stated as fact, not a suggestion. Where something is explicitly deferred, it's listed under "Out of Scope for v1" — do not build it unless the roadmap is revisited.

---

## 1. Project Overview

NeoBot connects a single Mineflayer bot to a single Minecraft server and keeps that server (and its own free-tier host) awake indefinitely, using human-like simulated activity to avoid AFK-kicks and anti-cheat detection. It ships as:

- A **GitHub template repository** — each user who wants to keep a server alive clicks "Use this template," gets their own copy, and deploys it as their own instance.
- A **one-click "Deploy to Render" button** in the README for the recommended host.
- A web **dashboard** for configuration, live status, and logs.
- An optional, toggleable **Discord bot** for remote control and alerts.

**Architecture principle: one deployed instance = one Mineflayer bot = one Minecraft server.** There is no multi-server management inside a single instance. Users who want to keep multiple servers alive deploy multiple instances from the template.

## 2. Goals

- Prevent the *hosting platform* (Render free tier, Replit, etc.) from idling the NeoBot process itself, via an HTTP endpoint pinged by UptimeRobot.
- Prevent the *Minecraft server* from AFK-kicking the bot, via configurable, human-like simulated activity.
- Survive kicks, crashes, and server restarts automatically, reacting appropriately to *why* it was disconnected.
- Be safe by default on real, populated survival servers (no world griefing, no spammy chat, pause near real players).
- Be genuinely pluggable and easy for open-source contributors to extend with new behaviors.
- Work with any server type that doesn't require a modloader: Vanilla, Paper, Purpur, Spigot, Forge (server-side, no client mods needed by the bot).

## 3. Non-Goals (v1)

- Managing multiple Minecraft servers from a single dashboard/instance.
- Microsoft/premium account authentication (offline/cracked-mode only).
- Multi-admin or role-based dashboard accounts.
- Publishing prebuilt Docker images to a registry.
- In-app self-update via `git pull`.

---

## 4. Tech Stack

| Layer | Choice |
|---|---|
| Language | TypeScript (strict mode) |
| Runtime | Node.js 22.x LTS (pinned via `.nvmrc` + `package.json` `engines`) |
| Package manager | npm |
| Bot engine | `mineflayer` + `mineflayer-pathfinder` |
| Backend server | Express |
| Realtime | Socket.IO |
| Frontend | React + Vite + Tailwind CSS |
| Persistence | Supabase (Postgres) |
| Discord | `discord.js` (full bot with slash commands, not just a webhook) |
| Logging | `pino` (structured logs; also mirrored to Supabase `events` table) |
| Testing | Vitest |
| Lint/Types | ESLint + `tsc --noEmit` |
| CI | GitHub Actions |
| Containerization | Docker + `docker-compose.yml` (local/prod-parity dev only, not published to a registry in v1) |

---

## 5. Repository Structure

```
neobot/
├── .github/
│   ├── workflows/          # ci.yml, release.yml, docker-check.yml
│   ├── ISSUE_TEMPLATE/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── dependabot.yml
├── src/
│   ├── bot/
│   │   ├── connection.ts       # connection manager, reconnect logic, kick-reason parsing
│   │   ├── hibernation.ts      # Aternos-style hibernating-host detection
│   │   ├── hazards.ts          # lava/drowning/fall/mob self-preservation
│   │   ├── safeMode.ts         # anti-cheat flag detection -> auto dial-back
│   │   └── behaviors/          # pluggable behavior modules (see §7)
│   │       ├── index.ts        # registry + behavior interface
│   │       ├── walk.ts
│   │       ├── jumpLook.ts
│   │       ├── chat.ts
│   │       ├── pathfindRandom.ts
│   │       ├── mineBlocks.ts
│   │       ├── swim.ts
│   │       ├── sneak.ts
│   │       ├── boat.ts
│   │       ├── doors.ts
│   │       ├── fish.ts
│   │       ├── eat.ts
│   │       ├── sleep.ts
│   │       ├── lookAtEntity.ts
│   │       └── itemDropPickup.ts
│   ├── server/
│   │   ├── app.ts              # Express app bootstrap
│   │   ├── auth/                # login/password, token-url, IP allowlist middleware
│   │   ├── routes/               # /api/*, /healthz, /status.json
│   │   ├── socket.ts             # Socket.IO live event bridge
│   │   ├── setupWizard.ts        # first-run wizard flow
│   │   └── rateLimit.ts
│   ├── discord/
│   │   ├── client.ts             # optional/toggleable bot bootstrap
│   │   ├── commands/              # /status /restart /pause /resume /logs /safe-mode /config /reconnect
│   │   └── alerts.ts               # per-event toggleable alert dispatcher
│   ├── db/
│   │   ├── client.ts              # Supabase client
│   │   ├── schema.sql             # table definitions (see §9)
│   │   └── repositories/           # config, events, sessions, liveState, adminUsers, alertSettings
│   ├── watchdog/
│   │   └── memoryWatchdog.ts       # RAM threshold monitor + tiered restart
│   └── config/
│       └── env.ts                   # env var + wizard-sourced config resolution
├── web/                               # React dashboard (Vite)
│   ├── src/
│   │   ├── pages/                     # Login, SetupWizard, Dashboard, Logs, Config, Minimap
│   │   ├── components/
│   │   └── theme/                     # ultra-polished black theme, cyan/electric-blue accents
│   └── ...
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BEHAVIOR_MODULE_GUIDE.md        # how to write a new pluggable behavior
│   └── DEPLOYMENT.md
├── assets/
│   └── logo.png                          # provided NeoBot logo
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── CHANGELOG.md
├── LICENSE                                  # MIT
└── README.md
```

---

## 6. Connection Manager

- Connects one Mineflayer bot instance to the one configured server (host, port, version).
- **Version handling:** auto-detect protocol version by default; manual override available in config/wizard. If the detected/specified version isn't supported by Mineflayer's protocol library, fail fast with a clear, actionable error — do not attempt to force a connection.
- **Reconnect:** exponential backoff by default, with a configurable max-retry count. On exceeding max retries, stop, mark status accordingly, and fire a Discord alert (if enabled).
- **Kick/disconnect reason parsing** — parse the disconnect reason text and branch behavior:
  | Reason detected | Behavior |
  |---|---|
  | AFK-kick | Reconnect immediately; consider nudging activity frequency up. |
  | Banned | Stop retrying. Mark status `banned` in dashboard. Alert immediately. Do not auto-retry. |
  | Server restarting / generic network drop | Backoff-retry (server likely coming back). |
  | Whitelist rejection | Stop tight retry loop; back off to a long interval (e.g. every 30 min). Alert once, don't spam. |
  | Server full | Retry with backoff. |
  | Anti-cheat kick (flying, movement flag, etc.) | Trigger Safe Mode (see §6.3) before reconnecting. |
  | Unrecognized | Log raw reason, treat as generic backoff-retry. |
- **Hibernating-host detection (Aternos-style):** detect "server offline / starting up" join-queue states distinct from a real failure; poll and reconnect once the server actually comes up, rather than counting these as failed retry attempts.
- **Hazard awareness:** react to lava proximity, drowning risk, fall-damage edges, and hostile mobs attacking the bot — basic self-preservation (retreat, swim up for air, avoid ledges) to prevent dying/losing inventory. This is in-scope for v1, not just cosmetic activity.
- **Safe Mode:** if repeated anti-cheat-pattern kicks/flags are detected, automatically dial back movement complexity/frequency. This is **on by default but toggleable** — users can disable auto-detection and tune manually instead.

---

## 7. Anti-AFK Behavior Engine (Pluggable Module System)

Each behavior is an independent module implementing a shared interface, registered in `src/bot/behaviors/index.ts`. This is a deliberate architectural choice so open-source contributors can add new behaviors without touching core logic.

```ts
interface AFKBehavior {
  name: string;
  enabledByDefault: boolean;
  weight: number; // relative selection frequency
  canRun(botState: BotState, config: NeoBotConfig): boolean;
  run(bot: Bot, botState: BotState): Promise<void>;
}
```

**v1 behavior modules:** randomized walk, jump, look-around, chat (see chat rules below), pathfind-to-random-point, mine/break blocks, swim, sneak, boat riding, open/close doors, fishing, eating, sleeping in a bed, look-at-nearby-entity, item drop/pickup.

**Human-like movement, not just goal execution:** movement is not purely `mineflayer-pathfinder` goal-completion. Layer imperfection on top — randomized micro-pauses, occasional backtracking, varied movement speed, small jitter — specifically to defeat pattern-based anti-cheat movement analysis (Vulcan/Grim/NCP-style), not just to look "busy."

**Each behavior is independently toggleable** with its own frequency/weight setting in config — this is a single-instance config (not per-server-slot, since v1 is one-to-one), but every behavior remains fully configurable.

**Chat behavior:** **off by default** (safest choice for real servers with real players). When enabled, uses a user-editable message pool of filler messages, sent at a random interval.

**Block interaction ("mining"):** configurable mode:
- `off` — no block interaction at all.
- `self-placed-only` — leave-no-trace: only ever breaks blocks it placed itself, net-zero world change.
- `radius-any` — may break/interact with any natural block within a configured radius/coordinate boundary around a set anchor point (e.g. spawn).
- A separate `boundless` toggle allows unrestricted roam/interaction for users running private/empty test servers who don't care about world state.

**Player-presence pause:** when a real player comes within a configurable radius, all simulated activity (movement, chat, mining) pauses automatically. Resumes once the area is clear. This is always-on behavior, not a toggle — it's a safety default.

---

## 8. Dashboard

### 8.1 Stack & Theme
React + Vite + Tailwind, Socket.IO client for live updates. **Ultra-polished black theme** using the NeoBot brand palette — near-black background, electric cyan/blue glow accents (matching the provided logo: pixel-art robot mascot, cyan neon glow, dark stone-brick background). **Both desktop and mobile-responsive.** Timestamps auto-detect the viewer's browser timezone for display (raw values stored in UTC).

### 8.2 Auth Model
Three independently toggleable layers — a solo user can run with just login+password and skip the rest:
1. **Login/password** — required baseline, single admin account created during setup wizard, bcrypt-hashed password.
2. **Token-based access URL** — an optional shareable link with an embedded access token.
3. **IP allowlist** — optional, off by default; "super-security" option for users who want it.

Rate limiting (`express-rate-limit` or equivalent) on the login endpoint and general API, with lockout after repeated failed attempts, from day one.

### 8.3 First-Run Setup Wizard
Served at the dashboard root until core setup is complete; replaces manual `.env` editing. Collects:
- Minecraft server host, port, version (or "auto-detect" toggle).
- Bot's in-game username.
- Supabase project URL + key.
- Discord bot token + guild ID (optional — leaving blank simply disables the Discord subsystem).
- Admin username + password (single admin, v1).
- IP allowlist entries (optional).
- Safe-zone anchor coordinates + radius, block-interaction mode.
- Chat toggle + initial message pool.
- Per-behavior enable/disable + weight defaults.

### 8.4 Live Dashboard Data
Show everything: connection state, uptime %, current activity, last-seen player count on the target server, recent log tail, last reconnect reason + history, resource usage (RAM), Safe Mode status, and a **2D live minimap** — the bot's X/Z position plotted on a simple canvas/SVG grid with a recent movement trail.

### 8.5 Config Export/Import
Dashboard button to download the current config as JSON, and to upload/restore from a JSON file — useful for backing up before a redeploy wipes ephemeral disk, or migrating between instances.

---

## 9. Persistence — Supabase Schema

Render/Replit free tiers have ephemeral disk; anything not in Supabase or git is lost on redeploy. Supabase is the source of truth for everything that needs to survive a redeploy, including **live state** (so the dashboard doesn't lose "current status" on a mid-session container restart).

```sql
-- singleton-style config for this one-to-one instance
create table config (
  id int primary key default 1,
  data jsonb not null,
  updated_at timestamptz default now(),
  constraint singleton check (id = 1)
);

create table live_state (
  id int primary key default 1,
  status text not null,           -- connected | disconnected | banned | reconnecting | hibernating-wait
  current_activity text,
  last_updated timestamptz default now(),
  data jsonb,                      -- position, player count, safe-mode flag, etc.
  constraint singleton check (id = 1)
);

create table events (
  id bigserial primary key,
  created_at timestamptz default now(),
  level text not null,             -- info | warn | error
  category text not null,          -- connection | behavior | discord | watchdog | security
  message text not null,
  meta jsonb
);

create table sessions (
  id bigserial primary key,
  connected_at timestamptz,
  disconnected_at timestamptz,
  disconnect_reason text
);

create table admin_users (
  id bigserial primary key,
  username text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table alert_settings (
  event_key text primary key,      -- e.g. 'connected', 'banned', 'reconnect_failed'
  enabled boolean default true
);
```

Config is bootstrapped from `.env`/setup wizard on first run, then Supabase becomes the live source of truth for all subsequent reads/writes.

---

## 10. Health / Status Endpoint

`GET /status.json` — **public, no auth** in v1 (required so UptimeRobot and other external monitors can hit it freely). Returns a JSON payload:

```json
{
  "status": "connected",
  "uptimePercent": 99.2,
  "currentActivity": "wandering",
  "lastUpdated": "2026-07-11T12:00:00Z",
  "version": "1.0.0"
}
```

This doubles as both the UptimeRobot keep-alive target and a lightweight public status API.

**Self-ping fallback:** UptimeRobot is the primary keep-alive mechanism. An optional internal self-ping (the app pinging its own `/status.json` on an interval) is available as a toggle, **default OFF**, for users who want a fallback in case UptimeRobot itself has downtime.

---

## 11. Discord Bot

**Toggleable and optional** — if no Discord bot token is provided during setup, this subsystem simply doesn't start; the dashboard and core bot function fine without it.

**Slash commands (v1):**
- `/status` — current connection/activity/uptime summary.
- `/restart` — restart the Mineflayer connection subsystem.
- `/pause` / `/resume` — pause/resume all simulated activity.
- `/logs [lines]` — recent log tail.
- `/safe-mode <on|off>` — toggle Safe Mode manually.
- `/config` — view current config summary.
- `/reconnect` — force an immediate reconnect attempt.

**Permissions:** open to anyone in the guild by default in v1 (no role restriction). Note this tradeoff explicitly in docs as a known limitation — role-based command restriction is a reasonable future enhancement, not required for v1.

**Alerts:** a configurable, per-event toggle list (stored in the `alert_settings` table), defaulting to all-on so nothing is missed by default, with easy per-event muting from the dashboard or a Discord command. Event types: connected, disconnected, reconnect-failed-after-max-retries, kicked (with parsed reason), banned, crash/error, low-resource/memory warning, Safe Mode triggered, hibernating-host detected.

---

## 12. Resource Management (512MB free-tier ceiling)

- **Memory watchdog:** monitors process RSS against a configurable threshold. On crossing it, first attempts a **tiered recovery** — restart the Mineflayer connection subsystem alone (cheap); only if memory doesn't recover does it restart the whole process (relying on the host's process manager, e.g. Render, to bring it back up).
- Single bot process per instance (post-pivot from the original multi-server idea) keeps this comfortably within budget for 2–3 concurrent behaviors/subsystems even on a 512MB tier.

---

## 13. Security

- Admin password: bcrypt-hashed.
- Discord bot token / Supabase service key: stored as environment variables, relying on Supabase's own encryption-at-rest and HTTPS in transit — **no additional app-level encryption layer in v1** (explicitly deferred; standard practice is sufficient for the threat model).
- Rate limiting + lockout on auth endpoints.
- `SECURITY.md` with a vulnerability-disclosure process, since this app handles server credentials and bot tokens.
- Auth layering as described in §8.2 — all independently toggleable, none forced.

---

## 14. Testing & CI

- **Vitest** for unit tests, written from day one alongside features (not bolted on after).
- **ESLint** + `tsc --noEmit` for lint/typecheck.
- **GitHub Actions**: run lint + typecheck + unit tests on every PR; a separate job builds the `Dockerfile` to verify it builds cleanly (image is *not* published to a registry in v1).
- Node 22.x pinned via `.nvmrc` and `package.json` `engines`.

---

## 15. Deployment Model

- Repo is a **GitHub template repository** ("Use this template" button).
- README includes a **"Deploy to Render" button** for one-click hosting.
- First boot serves the setup wizard until an admin account and core config exist; normal dashboard takes over after.
- **No in-app self-update.** Instead, the dashboard compares the local `package.json` version against the latest GitHub release tag and shows an "update available" banner linking to release notes. The actual update is a normal git-push/redeploy on the user's side.
- Local dev: `npm run dev` against a free dev Supabase project by default (simplest path, no local DB to manage). An **optional** `docker-compose.yml` is provided for prod-parity testing.

---

## 16. Open-Source Project Hygiene

All from day one:
- `LICENSE` — MIT.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.
- `.github/ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`.
- Dependabot enabled for automated dependency-update PRs.
- Semantic versioning; a release GitHub Action generates a changelog and creates a GitHub Release on `v*` tag push.
- `docs/ARCHITECTURE.md` and `docs/BEHAVIOR_MODULE_GUIDE.md` (how to write a new pluggable behavior module — important for community contributions).
- `assets/logo.png` — the provided NeoBot logo (pixel-art robot mascot, cyan/electric-blue neon glow, dark stone-brick background) — used in the README header and dashboard theme.

---

## 17. Explicitly Out of Scope for v1

Do not build these — they were considered and deliberately deferred:

- Multi-server-per-instance dashboard (superseded by the one-to-one template-repo model).
- Microsoft/premium Minecraft account authentication.
- Publishing Docker images to a registry (ghcr.io or otherwise).
- In-app `git pull`-based self-update.
- Multi-admin or role-based dashboard user accounts.
- Downloadable analytics export report (live dashboard + Discord alerts are sufficient).
- App-level secret encryption beyond standard hashing + Supabase's at-rest encryption.
- Mandatory IP allowlist (remains an optional, off-by-default toggle).
- Discord command role-restriction (open to anyone in v1; note as a known limitation).
- README live status badge — nice-to-have, can be added post-v1 without architectural impact.

---

## 18. Phased Build Plan

Recommended implementation order — each phase should be independently functional/testable before moving on:

1. **Scaffolding** — repo structure, TS config, ESLint/Vitest, CI skeleton, Dockerfile, LICENSE, template-repo settings, issue/PR templates.
2. **Core connection MVP** — connection manager, basic reconnect, kick-reason parsing, `/status.json` health endpoint. This alone is a deployable keep-alive MVP.
3. **Behavior engine core** — pluggable module interface + walk/jump/look/chat/pathfind-random, human-like movement imperfection layer.
4. **Extended behaviors** — mine/swim/sneak/boat/doors/fish/eat/sleep/lookAt/itemDropPickup, safe-zone/block-interaction modes, hazard awareness.
5. **Persistence layer** — Supabase schema, config/live-state/events/sessions repositories, hybrid bootstrap-then-live-source-of-truth flow.
6. **Dashboard backend** — Express + Socket.IO, auth (login/password + token-url + IP allowlist, each toggleable), rate limiting, setup wizard flow.
7. **Dashboard frontend** — React/Vite/Tailwind black-cyan theme, live status view, log viewer, minimap, config editor, export/import, mobile-responsive layout.
8. **Discord bot** — toggleable bootstrap, slash commands, per-event configurable alerts.
9. **Resource management** — memory watchdog with tiered recovery, self-ping toggle, Safe Mode auto-detection, hibernating-host (Aternos-style) detection.
10. **Docs & release automation** — README with Deploy-to-Render button, CONTRIBUTING/SECURITY/ARCHITECTURE docs, Dependabot, semver release workflow.
11. **Polish** — status badge (optional), additional community-contributed behavior modules.

---

## 19. Branding Reference

- Name: **NeoBot**
- Logo: pixel-art robot mascot head, electric cyan/blue neon outline glow, dark navy/near-black stone-brick textured background, small floating debris/particle accents.
- Palette: near-black base (`#0a0e14`-ish), electric cyan/blue accent family (`#4fd8ff`-ish), used consistently across dashboard theme and README styling.
