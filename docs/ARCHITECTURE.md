# Architecture

> **Status:** stub — expanded in Phase 10. See `masterdoc (2).md` for the
> authoritative design.

## One-to-one model

One deployed instance = one Mineflayer bot = one Minecraft server. There is no
multi-server management inside a single instance.

## Subsystems (target)

| Subsystem | Location | Phase |
|---|---|---|
| Connection manager + reconnect | `src/bot/connection.ts` | 2 ✅ |
| Kick-reason classifier | `src/bot/kickReasons.ts` | 2 ✅ |
| Live-state store (in-memory) | `src/bot/state.ts` | 2 ✅ |
| Health/status server | `src/server/app.ts`, `src/server/routes/status.ts` | 2 ✅ |
| Behavior engine + scheduler | `src/bot/behaviorEngine.ts` | 3 ✅ |
| Pluggable behaviors + humanize | `src/bot/behaviors/` | 3–4 ✅ |
| Player-presence pause | `src/bot/playerPresence.ts` | 3 ✅ |
| Extended behaviors (14 total) | `src/bot/behaviors/*.ts` | 4 ✅ |
| Block-interaction modes + safe-zone | `src/bot/blockInteraction.ts`, `src/bot/safeZone.ts` | 4 ✅ |
| Hazard self-preservation | `src/bot/hazards.ts` | 4 ✅ |
| Behavior engine | `src/bot/behaviors/` | 3–4 |
| Hazards / safe mode / hibernation | `src/bot/` | 4, 9 |
| Persistence (Supabase) | `src/db/` | 5 |
| Dashboard server (Express + Socket.IO) | `src/server/` | 6 |
| Dashboard UI (React) | `web/` | 7 |
| Discord bot | `src/discord/` | 8 |
| Memory watchdog | `src/watchdog/` | 9 |

## Cross-cutting foundations (Phase 1)

- `src/config/env.ts` — validated environment resolution (zod).
- `src/lib/logger.ts` — structured logging (pino), later mirrored to Supabase.
