<div align="center">
  <img src="assets/logo.png" alt="NeoBot" width="160" />

  <h1>NeoBot</h1>

  <p><strong>A Mineflayer-based anti-AFK bot that keeps a Minecraft server alive — self-hostable, open-source, one-click deployable.</strong></p>

  <p>
    <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-4fd8ff" />
    <img alt="Node 22" src="https://img.shields.io/badge/node-22.x-3c873a" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6" />
    <img alt="Status: Phase 7" src="https://img.shields.io/badge/build-Phase%207%20dashboard-4fd8ff" />
  </p>
</div>

---

NeoBot connects a single Mineflayer bot to a single Minecraft server and keeps
both that server **and its own free-tier host** awake indefinitely, using
human-like simulated activity to avoid AFK-kicks and anti-cheat detection.

> **Architecture principle:** one deployed instance = one bot = one server.
> To keep multiple servers alive, deploy multiple instances from this template.
> This Architecture is Specifically Chosen To Provide Simple Yet Robustness.

## Why it works

- **Keeps the host awake.** Free hosts (e.g. Render) spin a service down after
  ~15 minutes of no *inbound* traffic. NeoBot exposes a public `GET /status.json`
  endpoint that an external monitor (UptimeRobot free, 5-minute interval) pings
  to keep the process alive. The bot's *outbound* Minecraft connection does not
  count as inbound traffic, so this endpoint is what actually prevents sleep.
- **Keeps the bot in-game.** A pluggable behavior engine performs randomized,
  human-like activity (walk, jump, look, pathfind, and more) with intentional
  movement imperfection to defeat pattern-based anti-cheat.
- **Survives failure.** Reconnects with backoff, parses *why* it was
  disconnected (AFK vs. ban vs. restart vs. anti-cheat), and self-preserves
  against hazards.

> ⚠️ UptimeRobot's free plan is for personal/non-commercial use only (per their
> ToS since Dec 2024). A self-ping fallback exists but cannot revive an
> already-slept process — it only defends against in-game AFK-kicks.

## Tech stack

TypeScript (strict) · Node 22 · `mineflayer` + `mineflayer-pathfinder` · Express ·
Socket.IO · React + Vite + Tailwind · Supabase (Postgres) · `discord.js` ·
`pino` · Vitest · Docker.

## Quick start (development)

```bash
git clone <your-fork-url> neobot && cd neobot
npm install
cp .env.example .env      # optional — the setup wizard can fill this in later
npm run dev
```

Then open `http://localhost:3000` for the dashboard. On first run it shows the
**setup wizard**; after that, sign in with the admin account you create. NeoBot
boots with **zero credentials** — Supabase and Discord are optional and can be
configured through the wizard (secrets stay in the environment).

To develop the dashboard UI with hot-reload, run the backend (`npm run dev`) and
the Vite dev server (`npm run dev:web`) side by side — Vite proxies the API and
Socket.IO to the backend on port 3000.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run in watch mode (`tsx`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm test` | Run the Vitest suite |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` | Prettier |

## Deployment

A **"Deploy to Render"** one-click button and Render Blueprint (`render.yaml`)
are added in Phase 10. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Build roadmap

NeoBot is built phase by phase (see [`masterdoc (2).md`](<masterdoc (2).md>) §18):

- [x] **Phase 1 — Scaffolding**: repo structure, toolchain, CI, Docker, OSS hygiene
- [x] **Phase 2 — Core connection MVP**: connection manager, kick-reason parsing, reconnect/backoff, public `/status.json`
- [x] **Phase 3 — Behavior engine core**: pluggable behaviors (walk/jumpLook/pathfindRandom/chat), human-like movement, always-on player-presence pause
- [x] **Phase 4 — Extended behaviors + hazards**: mine/swim/sneak/boat/doors/fish/eat/sleep/lookAt/itemDrop, block-interaction modes, lava/drowning/fall/mob self-preservation
- [x] **Phase 5 — Supabase persistence**: config/live-state/events/sessions repositories with in-memory fallback, hybrid bootstrap-then-source-of-truth
- [x] **Phase 6 — Dashboard backend**: `/api/*`, three toggleable auth layers, rate limiting, setup wizard, control actions, Socket.IO live bridge
- [x] **Phase 7 — Dashboard frontend**: React + Vite + Tailwind SPA (login, setup wizard, live dashboard with 2D minimap, logs, config export/import), served by Express
- [x] **Phase 8 — Discord bot**: slash commands (`/status`, `/pause`, `/restart`, …), per-event push alerts, dashboard + Discord alert toggles
- [x] **Phase 9 — Resource management**: memory watchdog (tiered recovery), Safe Mode auto dial-back, Aternos-style hibernation detection, self-ping fallback
- [ ] Phase 10 — Docs & release automation
- [ ] Phase 11 — Polish

## Contributing

Contributions welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md) and our
[Code of Conduct](CODE_OF_CONDUCT.md). The behavior engine is deliberately
pluggable so you can add new behaviors without touching core logic.

## License

[MIT](LICENSE) © ashfaqizop
