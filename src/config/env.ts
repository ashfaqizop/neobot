/**
 * Environment configuration resolution.
 *
 * This is the single, typed, validated entry point for reading environment
 * variables. Every subsystem (bot, server, discord, db, watchdog) resolves its
 * configuration through here rather than touching `process.env` directly.
 *
 * Design principle (masterdoc §Non-Goals / graceful degradation): the app must
 * boot with ZERO pre-provisioned credentials. Almost everything here is
 * therefore optional — missing Supabase falls back to an in-memory store
 * (Phase 5), missing Discord disables that subsystem (Phase 8), and missing
 * admin credentials trigger the first-run setup wizard (Phase 6).
 *
 * On first run, `.env` / the setup wizard bootstraps config; thereafter Supabase
 * becomes the live source of truth (masterdoc §9).
 */
import { z } from 'zod';

/** Coerce common truthy/falsy string spellings into a boolean. */
const booleanish = z
  .string()
  .transform((v) => ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase()))
  .pipe(z.boolean());

const envSchema = z.object({
  // --- Runtime ---
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  // --- Minecraft target server (masterdoc §6) ---
  MC_HOST: z.string().min(1).optional(),
  MC_PORT: z.coerce.number().int().positive().max(65535).default(25565),
  /** Leave unset for auto-detect (masterdoc §6 version handling). */
  MC_VERSION: z.string().min(1).optional(),
  MC_USERNAME: z.string().min(1).optional(),

  // --- Supabase (masterdoc §9). Optional -> in-memory fallback. ---
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_KEY: z.string().min(1).optional(),

  // --- Discord (masterdoc §11). Optional -> subsystem disabled. ---
  DISCORD_BOT_TOKEN: z.string().min(1).optional(),
  DISCORD_GUILD_ID: z.string().min(1).optional(),

  // --- Dashboard admin (masterdoc §8.2). Optional -> setup wizard. ---
  ADMIN_USERNAME: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(1).optional(),

  // --- Safe-zone anchor + block interaction (masterdoc §7) ---
  SAFE_ZONE_X: z.coerce.number().optional(),
  SAFE_ZONE_Y: z.coerce.number().optional(),
  SAFE_ZONE_Z: z.coerce.number().optional(),
  SAFE_ZONE_RADIUS: z.coerce.number().nonnegative().default(32),

  // --- Keep-alive (masterdoc §10). Self-ping default OFF. ---
  SELF_PING_ENABLED: booleanish.default('false'),
  SELF_PING_URL: z.string().url().optional(),
});

/** Fully-resolved, validated environment configuration. */
export type Env = z.infer<typeof envSchema>;

function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

/** The resolved environment, validated once at module load. */
export const env: Env = loadEnv();

/** True when a Supabase connection is configured (else in-memory fallback). */
export const hasSupabase = (): boolean => Boolean(env.SUPABASE_URL && env.SUPABASE_KEY);

/** True when the Discord subsystem should start. */
export const hasDiscord = (): boolean => Boolean(env.DISCORD_BOT_TOKEN && env.DISCORD_GUILD_ID);

/** Exposed for unit testing against a synthetic environment. */
export const __loadEnvForTest = loadEnv;
