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

## Render (planned)

A one-click **Deploy to Render** button and a `render.yaml` Blueprint
(`autoDeploy: false` for template installs) are added in Phase 10.

## Local / prod-parity

```bash
cp .env.example .env
docker compose up --build
```
