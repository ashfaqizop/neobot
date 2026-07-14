# Architecture

NeoBot keeps a single Minecraft server — and its own free-tier host — awake by
running one Mineflayer bot that simulates human-like activity, fronted by a
dashboard, a Discord bot, and a resilience layer. `masterdoc (2).md` is the
authoritative design; this document is the practical map of the code.

## One-to-one model

**One deployed instance = one Mineflayer bot = one Minecraft server.** There is
no multi-server management inside an instance — to keep several servers alive,
deploy several instances from this template. This keeps each process small enough
for a 512 MB free tier and the whole design simple.

## Runtime topology

```text
 UptimeRobot ──GET /status.json──►┐
                                  │        ┌─────────────── Discord (optional)
 Operator ──HTTPS──► Dashboard ───┤        │  slash commands + per-event alerts
             (React SPA + /api)   │        ▼
                                  ▼   ┌──────────┐   offline auth   ┌───────────────┐
                            NeoBot process ──────► Mineflayer bot ──► Minecraft server
                                  │   └──────────┘                   └───────────────┘
                                  ├─ Supabase (optional) — durable config/state/events
                                  └─ in-memory fallback  — zero-credential boot
```

- **Inbound `/status.json`** (public, no auth) is what actually keeps a free host
  awake — the bot's *outbound* Minecraft connection doesn't count as inbound
  traffic. UptimeRobot is the primary pinger; an optional internal self-ping is a
  fallback (it can't wake an already-slept host).
- **Graceful degradation is a first principle:** with no Supabase the app uses an
  in-memory store; with no Discord token that subsystem never starts; with no
  admin the dashboard shows the setup wizard. It always boots with zero
  credentials.

## Subsystem map

| Subsystem | Location | Phase |
|---|---|---|
| Connection manager + reconnect/backoff | `src/bot/connection.ts` | 2 |
| Kick-reason classifier | `src/bot/kickReasons.ts` | 2 |
| Live-state store (`EventEmitter`) | `src/bot/state.ts` | 2 |
| Health/status server | `src/server/app.ts`, `src/server/routes/status.ts` | 2 |
| Behavior engine + scheduler | `src/bot/behaviorEngine.ts` | 3 |
| Pluggable behaviors + humanize | `src/bot/behaviors/` | 3–4 |
| Player-presence pause | `src/bot/playerPresence.ts` | 3 |
| Block-interaction modes + safe-zone | `src/bot/blockInteraction.ts`, `src/bot/safeZone.ts` | 4 |
| Hazard self-preservation | `src/bot/hazards.ts` | 4 |
| Persistence (Supabase + in-memory) | `src/db/` | 5 |
| Persisted app config | `src/config/appConfig.ts` | 5 |
| Dashboard API + auth + rate limit | `src/server/` | 6 |
| Setup wizard | `src/server/setupWizard.ts` | 6 |
| Control seam (pause/restart/…) | `src/bot/controller.ts` | 6 |
| Socket.IO live bridge | `src/server/socket.ts` | 6 |
| Dashboard UI (React SPA) | `web/` | 7 |
| Discord bot (commands + alerts) | `src/discord/` | 8 |
| Alert-settings API | `src/server/routes/alerts.ts` | 8 |
| Memory watchdog + self-ping | `src/watchdog/` | 9 |
| Safe Mode auto dial-back | `src/bot/safeMode.ts` | 9 |
| Hibernation detection | `src/bot/hibernation.ts` | 9 |

## Cross-cutting foundations (Phase 1)

- `src/config/env.ts` — validated environment resolution (zod). The single place
  `process.env` is read; `hasSupabase()`/`hasDiscord()` gate optional subsystems.
- `src/lib/logger.ts` — structured logging (pino); events are also persisted to
  the `events` table and surfaced in the dashboard + Discord.

## Data & control flow

1. **Connection.** `ConnectionManager` connects one offline-auth bot, classifies
   every disconnect (`kickReasons.ts`) into a retry strategy (immediate / backoff
   / long / poll / none), and drives reconnection. It writes status/sessions into
   the `LiveStateStore`.
2. **Behavior.** On spawn it starts the `BehaviorEngine`, which weight-selects one
   eligible behavior per humanized cycle. Player-presence and hazards are
   always-on guardians that outrank normal activity; Safe Mode dials the set down.
3. **State → surfaces.** `LiveStateStore` is an `EventEmitter`: the persistence
   bridge mirrors it into Supabase, and `socket.ts` pushes it to dashboard clients
   live. `/status.json` exposes the public subset; `/api/state` the authed full
   snapshot (incl. RAM + position).
4. **Operator actions** flow through one seam, `BotController`
   (pause/resume/restart/reconnect/safe-mode), shared by the dashboard control API
   **and** the Discord bot — so the two can never drift.
5. **Alerts** raised by the connection layer, watchdog, and Safe-Mode manager fan
   out through a single dispatcher (`src/index.ts`) to the log, the `events`
   table, and Discord (gated per-event by `alert_settings`).

## Key patterns

- **Injectable seams.** The connection manager, engine, watchdog, and alerter all
  take their collaborators as options (`getConfig`, `onAlert`, `onAntiCheat`,
  `readMemory`, clocks, fetch). This is why nearly everything is unit-testable
  without a live Minecraft server, gateway, or real OOM.
- **Dual-implementation repositories.** Every repository in `src/db/` has a
  Supabase and an in-memory implementation behind one interface, selected by
  `hasSupabase()` — the app behaves identically with or without a database.
- **Hybrid config.** `config.getOrBootstrap(defaults)`: env seeds the config on
  first run, then Supabase (or memory) is the live source of truth, edited via the
  dashboard. Secrets never enter the config — they stay env-only.
- **One process, one port.** Express serves both the `/api` surface and the built
  React SPA (`web/dist`), so the session cookie and Socket.IO are same-origin.

## Deployment

One Docker image (multi-stage, non-root, `--max-old-space-size=400`) runs the
whole thing. Deploy to Render via the [`render.yaml`](../render.yaml) Blueprint,
keep it awake with UptimeRobot, and optionally attach Supabase (durable state) and
Discord (control + alerts). See [`DEPLOYMENT.md`](DEPLOYMENT.md).
