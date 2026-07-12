/**
 * First-run setup wizard (masterdoc §8.3).
 *
 * Replaces manual `.env` editing for non-secret config. Collects the admin
 * account + connection/behavior/auth settings, creates the admin (bcrypt), and
 * writes the `config` row. Secrets (Supabase/Discord) stay env-only (§13) — the
 * status endpoint merely reports whether they're configured.
 */
import { z } from 'zod';
import { env, hasDiscord, hasSupabase } from '../config/env.js';
import { buildDefaultAppConfig, type AppConfig } from '../config/appConfig.js';
import type { Repositories } from '../db/types.js';
import { hashPassword } from './auth/password.js';
import { generateAccessToken } from './auth/token.js';

export class SetupError extends Error {}

export const setupSchema = z.object({
  admin: z.object({
    username: z.string().min(1).max(64),
    password: z.string().min(6).max(200),
  }),
  connection: z
    .object({
      host: z.string().min(1).nullable().optional(),
      port: z.coerce.number().int().positive().max(65535).optional(),
      version: z.string().min(1).nullable().optional(),
      username: z.string().min(1).nullable().optional(),
    })
    .optional(),
  safeZone: z
    .object({
      x: z.number().nullable(),
      y: z.number().nullable(),
      z: z.number().nullable(),
      radius: z.number().nonnegative(),
    })
    .optional(),
  blockInteraction: z
    .object({
      mode: z.enum(['off', 'self-placed-only', 'radius-any']),
      boundless: z.boolean(),
    })
    .optional(),
  chat: z
    .object({
      enabled: z.boolean(),
      messages: z.array(z.string()).optional(),
    })
    .optional(),
  behaviors: z.record(z.object({ enabled: z.boolean(), weight: z.number().nonnegative() })).optional(),
  auth: z
    .object({
      tokenUrl: z.object({ enabled: z.boolean() }).optional(),
      ipAllowlist: z.object({ enabled: z.boolean(), entries: z.array(z.string()) }).optional(),
    })
    .optional(),
});

export type SetupPayload = z.infer<typeof setupSchema>;

/** Setup is required until the single admin account exists. */
export async function needsSetup(repos: Repositories): Promise<boolean> {
  return (await repos.adminUsers.count()) === 0;
}

/** Assemble an AppConfig from the wizard payload, layered over env defaults. */
export function buildAppConfigFromPayload(payload: SetupPayload): AppConfig {
  const base = buildDefaultAppConfig(env);

  const pc = payload.connection ?? {};
  const connection = {
    host: pc.host ?? base.connection.host,
    port: pc.port ?? base.connection.port,
    version: pc.version ?? base.connection.version,
    username: pc.username ?? base.connection.username,
  };

  const behavior = { ...base.behavior };
  if (payload.safeZone) behavior.safeZone = { ...behavior.safeZone, ...payload.safeZone };
  if (payload.blockInteraction) behavior.blockInteraction = { ...payload.blockInteraction };
  if (payload.chat) {
    behavior.chat = {
      ...behavior.chat,
      enabled: payload.chat.enabled,
      ...(payload.chat.messages ? { messages: payload.chat.messages } : {}),
    };
    behavior.behaviors = {
      ...behavior.behaviors,
      chat: { enabled: payload.chat.enabled, weight: behavior.behaviors.chat?.weight ?? 1 },
    };
  }
  if (payload.behaviors) {
    behavior.behaviors = { ...behavior.behaviors, ...payload.behaviors };
  }

  const auth = { ...base.auth };
  if (payload.auth?.tokenUrl) {
    auth.tokenUrl = {
      enabled: payload.auth.tokenUrl.enabled,
      token: payload.auth.tokenUrl.enabled ? generateAccessToken() : null,
    };
  }
  if (payload.auth?.ipAllowlist) {
    auth.ipAllowlist = { ...payload.auth.ipAllowlist };
  }

  return { connection, behavior, auth };
}

/** Run first-time setup: create the admin and persist the config. */
export async function runSetup(payload: SetupPayload, repos: Repositories): Promise<AppConfig> {
  if ((await repos.adminUsers.count()) > 0) {
    throw new SetupError('already_configured');
  }
  const passwordHash = await hashPassword(payload.admin.password);
  await repos.adminUsers.create(payload.admin.username, passwordHash);

  const config = buildAppConfigFromPayload(payload);
  await repos.config.save(config);
  return config;
}

/** Public setup status (no secrets). */
export async function setupStatus(repos: Repositories): Promise<{
  needsSetup: boolean;
  supabaseConfigured: boolean;
  discordConfigured: boolean;
}> {
  return {
    needsSetup: await needsSetup(repos),
    supabaseConfigured: hasSupabase(),
    discordConfigured: hasDiscord(),
  };
}
