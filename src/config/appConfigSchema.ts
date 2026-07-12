/**
 * Zod schema for the full {@link AppConfig}, used to validate config PUT/import
 * (masterdoc §8.5). Mirrors the interfaces in `appConfig.ts` / `behaviors/types.ts`.
 */
import { z } from 'zod';

const behaviorSetting = z.object({ enabled: z.boolean(), weight: z.number().nonnegative() });

export const neoBotConfigSchema = z.object({
  behaviors: z.record(behaviorSetting),
  chat: z.object({
    enabled: z.boolean(),
    messages: z.array(z.string()),
    minIntervalMs: z.number().nonnegative(),
    maxIntervalMs: z.number().nonnegative(),
  }),
  playerPause: z.object({ radius: z.number().nonnegative() }),
  safeZone: z.object({
    x: z.number().nullable(),
    y: z.number().nullable(),
    z: z.number().nullable(),
    radius: z.number().nonnegative(),
  }),
  blockInteraction: z.object({
    mode: z.enum(['off', 'self-placed-only', 'radius-any']),
    boundless: z.boolean(),
  }),
  hazards: z.object({ enabled: z.boolean() }),
  cycle: z.object({ minMs: z.number().nonnegative(), maxMs: z.number().nonnegative() }),
});

export const appConfigSchema = z.object({
  connection: z.object({
    host: z.string().nullable(),
    port: z.number().int().positive().max(65535),
    version: z.string().nullable(),
    username: z.string().nullable(),
  }),
  behavior: neoBotConfigSchema,
  auth: z.object({
    tokenUrl: z.object({ enabled: z.boolean(), token: z.string().nullable() }),
    ipAllowlist: z.object({ enabled: z.boolean(), entries: z.array(z.string()) }),
  }),
});
