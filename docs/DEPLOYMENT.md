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

## Render (planned)

A one-click **Deploy to Render** button and a `render.yaml` Blueprint
(`autoDeploy: false` for template installs) are added in Phase 10.

## Local / prod-parity

```bash
cp .env.example .env
docker compose up --build
```
