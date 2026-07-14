# Deployment

> **Status:** stub — expanded in Phase 10 (Deploy-to-Render button + Render
> Blueprint).

## Keep-alive model

Free hosts spin a web service down after a period of no **inbound** traffic
(Render: ~15 minutes). NeoBot exposes a public `GET /status.json` (Phase 2) that
an external monitor pings to keep the process awake.

- **Primary:** [UptimeRobot](https://uptimerobot.com/) free plan pings every
  5 minutes — comfortably inside Render's 15-minute window.
  - Note: UptimeRobot's free plan is for **non-commercial** use only.
- **Fallback:** an optional internal self-ping (default OFF). It cannot revive an
  already-slept process, so it only guards against in-game AFK-kicks, not host
  sleep.

## Live status badge (optional)

NeoBot serves a public `GET /badge.json` in the [Shields.io endpoint
format](https://shields.io/badges/endpoint-badge). Embed a live status badge for
your deployment with:

```
https://img.shields.io/endpoint?url=https://<your-service>.onrender.com/badge.json
```

It reflects the bot's live status (`connected` green, `reconnecting`/
`hibernating-wait` yellow, `banned`/`disconnected` red).

## Supabase (persistence)

Free hosts have **ephemeral disk** — anything not in Supabase or git is lost on
redeploy. Supabase is NeoBot's durable source of truth for config, live status,
events, and session history. It is **optional**: with no Supabase configured,
NeoBot runs on an in-memory fallback (data resets on restart).

To enable durable persistence:

1. Create a free project at [supabase.com](https://supabase.com/).
2. In the project's **SQL editor**, run the contents of
   [`src/db/schema.sql`](../src/db/schema.sql) once (creates the six tables).
3. Set `SUPABASE_URL` and `SUPABASE_KEY` (service role key) in your environment.

**Bootstrap behavior (masterdoc §9):** on the *first* run, NeoBot seeds the
`config` table from your `.env`. After that, **Supabase is the source of truth** —
later `.env` changes to config values no longer override it; edit config via the
dashboard/setup wizard (Phase 6) instead. Secrets (`SUPABASE_KEY`,
`DISCORD_BOT_TOKEN`) always stay in the environment and are never stored in the
`config` table.

## Dashboard API & auth

The dashboard backend (Phase 6) serves under `/api/*`. On first boot, with no
admin account yet, `GET /api/setup/status` reports `needsSetup: true`; submit the
setup wizard (`POST /api/setup`) to create the admin and write config.

Three independently toggleable auth layers (masterdoc §8.2):

1. **Login/password** — required baseline (bcrypt-hashed admin). Sessions are
   signed cookies; set `SESSION_SECRET` to a long random value so sessions
   survive restarts (otherwise a fresh secret is generated each boot).
2. **Token-URL** — optional shareable `?token=` access, enabled via the wizard.
3. **IP allowlist** — optional "super-security" gate, applied on top of the rest.

Login and the API are rate-limited (lockout after repeated failed logins).
Secrets (`SUPABASE_KEY`, `DISCORD_BOT_TOKEN`) are **never** collected or stored by
the wizard — set them in the environment.

## Discord bot (optional)

The Discord subsystem (Phase 8) is **toggleable** — with no token/guild set it
never starts, and the dashboard + core bot work fine without it.

To enable it:

1. Create an application at the
   [Discord Developer Portal](https://discord.com/developers/applications) and
   add a **Bot**. Copy the **bot token**.
2. Invite the bot to your server with the **`bot`** and **`applications.commands`**
   scopes (OAuth2 URL generator). No privileged intents are required — NeoBot
   uses only the non-privileged `Guilds` intent.
3. Set the environment:
   - `DISCORD_BOT_TOKEN` — the bot token.
   - `DISCORD_GUILD_ID` — your server (guild) ID.
   - `DISCORD_ALERT_CHANNEL_ID` — *optional*; where alerts post. If unset, NeoBot
     uses the guild's system channel, else the first channel it can post to.

**Slash commands:** `/status`, `/pause`, `/resume`, `/restart`, `/reconnect`,
`/safe-mode <on|off>`, `/logs [lines]`, `/config`, and
`/alerts <view|mute|unmute>`. Commands register automatically (guild-scoped) on
startup.

**Alerts:** per-event push notifications (connected, disconnected, kicked,
banned, reconnect-failed, …), toggled per event from the dashboard's **Discord
alerts** panel or the `/alerts` command. Default is all-on.

> **Known limitation (v1):** commands are open to **anyone in the guild** — there
> is no role restriction yet. Keep the bot in a trusted/private server, or a
> channel only trusted members can reach. Role-based restriction is a planned
> enhancement, not required for v1.

## Resource management & resilience (Phase 9)

NeoBot is built to survive unattended on a 512 MB free tier (masterdoc §12):

- **Memory watchdog.** Process RSS is polled against `MEMORY_THRESHOLD_MB`
  (default 400). On crossing it, recovery is **tiered**: first restart the
  Mineflayer connection alone (cheap); if memory hasn't recovered after
  `MEMORY_GRACE_MS`, the process exits so the host's manager restarts it fresh.
  The Docker image sets `NODE_OPTIONS=--max-old-space-size=400` to cap the V8
  heap below the container ceiling.
- **Safe Mode.** After repeated anti-cheat kicks (`SAFE_MODE_AUTO`, on by
  default), NeoBot dials movement complexity/frequency down automatically to
  shake pattern-based anti-cheat. Toggle it manually from the dashboard, the
  Discord `/safe-mode` command, or disable auto-detection in config.
- **Hibernation (Aternos-style).** "Server starting / in queue / offline" join
  states are detected and **polled** on a steady interval (status
  `hibernating-wait`) instead of burning the reconnect budget — the bot rejoins
  once the host actually wakes.
- **Self-ping fallback.** Set `SELF_PING_ENABLED=true` (default off) for an
  internal ping of `/status.json`. It only guards in-game AFK-kicks — it **cannot
  revive an already-slept host**, so UptimeRobot remains the primary keep-alive.

## Deploy to Render (one-click)

The repo ships a [`render.yaml`](../render.yaml) Blueprint, so you can stand up a
free instance in a couple of clicks:

1. Click **[Deploy to Render](https://render.com/deploy?repo=https://github.com/ashfaqizop/neobot)**
   (or, in the Render dashboard, **New → Blueprint** and point it at your fork).
   Render builds the image from the root `Dockerfile` (`runtime: docker`,
   `plan: free`) and injects `PORT` automatically.
2. On the Blueprint screen, fill in any `sync: false` env vars you want to set now
   (`MC_HOST`, `MC_USERNAME`, `SUPABASE_URL`/`SUPABASE_KEY`, `DISCORD_BOT_TOKEN`/
   `DISCORD_GUILD_ID`) — or leave them blank and configure everything from the
   in-app **setup wizard** later. `SESSION_SECRET` is generated for you.
3. Once live, create your admin account via the wizard, then point
   [UptimeRobot](https://uptimerobot.com/) at `https://<your-service>.onrender.com/status.json`
   (5-minute interval) to keep the free service awake.

**Why `autoDeployTrigger: off`?** The Blueprint disables auto-deploy so a template
install doesn't redeploy on every upstream commit. In your own fork, set it to
`commit` (or `checksPass`) if you want pushes to redeploy.

> Render's free web services sleep after ~15 minutes of no **inbound** traffic —
> that's exactly what the UptimeRobot ping prevents. The internal self-ping cannot
> wake an already-slept host, so UptimeRobot remains the primary keep-alive.

## Local / prod-parity

```bash
cp .env.example .env
docker compose up --build
```
