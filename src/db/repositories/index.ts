/**
 * Repository factory (masterdoc §9).
 *
 * Returns Supabase-backed repositories when Supabase is configured, otherwise a
 * fully in-memory set — so NeoBot behaves identically (just non-durable) with
 * zero credentials.
 *
 * Boot resilience (masterdoc "always boots / survives failure"): when Supabase
 * IS configured but unreachable or not migrated (e.g. `schema.sql` wasn't run,
 * or PostgREST's schema cache hasn't refreshed yet after creating the tables),
 * {@link createRepositoriesReady} retries briefly and then falls back to
 * in-memory with a loud, actionable warning — rather than throwing on the first
 * query and crash-looping the deploy.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { childLogger } from '../../lib/logger.js';
import { getSupabaseClient } from '../client.js';
import type { Repositories } from '../types.js';
import { InMemoryConfigRepository, SupabaseConfigRepository } from './config.js';
import { InMemoryLiveStateRepository, SupabaseLiveStateRepository } from './liveState.js';
import { InMemoryEventsRepository, SupabaseEventsRepository } from './events.js';
import { InMemorySessionsRepository, SupabaseSessionsRepository } from './sessions.js';
import { InMemoryAdminUsersRepository, SupabaseAdminUsersRepository } from './adminUsers.js';
import { InMemoryAlertSettingsRepository, SupabaseAlertSettingsRepository } from './alertSettings.js';

const log = childLogger('db');

function inMemoryRepositories(): Repositories {
  return {
    config: new InMemoryConfigRepository(),
    liveState: new InMemoryLiveStateRepository(),
    events: new InMemoryEventsRepository(),
    sessions: new InMemorySessionsRepository(),
    adminUsers: new InMemoryAdminUsersRepository(),
    alertSettings: new InMemoryAlertSettingsRepository(),
  };
}

function supabaseRepositories(client: SupabaseClient): Repositories {
  return {
    config: new SupabaseConfigRepository(client),
    liveState: new SupabaseLiveStateRepository(client),
    events: new SupabaseEventsRepository(client),
    sessions: new SupabaseSessionsRepository(client),
    adminUsers: new SupabaseAdminUsersRepository(client),
    alertSettings: new SupabaseAlertSettingsRepository(client),
  };
}

/**
 * Synchronous factory (no connectivity check). Used by tests and callers that
 * don't need the boot probe. Prefer {@link createRepositoriesReady} at startup.
 */
export function createRepositories(): Repositories {
  const client = getSupabaseClient();
  if (!client) {
    log.warn('Supabase not configured — using in-memory persistence (data is lost on restart).');
    return inMemoryRepositories();
  }
  log.info('Supabase configured — persistence is durable across redeploys.');
  return supabaseRepositories(client);
}

export interface ReadyOptions {
  /** Total probe attempts before falling back to in-memory (default 5). */
  retries?: number;
  /** Delay between attempts, ms (default 3000). */
  delayMs?: number;
  /** Injectable sleep (tests). */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Injectable readiness probe (tests). Resolves `null` when Supabase is ready,
   * or `{ error }` when it isn't. Defaults to a light `alert_settings` select.
   */
  probe?: (client: SupabaseClient) => Promise<{ error: unknown } | null>;
}

const errMessage = (e: unknown): string =>
  typeof e === 'object' && e !== null && 'message' in e ? String(e.message) : String(e);

/**
 * Resilient startup factory. When Supabase is configured, verify it's reachable
 * AND migrated (retrying the transient PostgREST schema-cache race); on
 * persistent failure, fall back to in-memory so the process still boots. Never
 * throws for a Supabase problem.
 */
export async function createRepositoriesReady(opts: ReadyOptions = {}): Promise<Repositories> {
  return resolveReadyRepositories(getSupabaseClient(), opts);
}

/**
 * Client-injectable core of {@link createRepositoriesReady} (exported for tests).
 * `null` client → in-memory; otherwise probe → retry → fall back to in-memory.
 */
export async function resolveReadyRepositories(
  client: SupabaseClient | null,
  opts: ReadyOptions = {},
): Promise<Repositories> {
  if (!client) {
    log.warn('Supabase not configured — using in-memory persistence (data is lost on restart).');
    return inMemoryRepositories();
  }

  const retries = opts.retries ?? 5;
  const delayMs = opts.delayMs ?? 3_000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const probe =
    opts.probe ??
    (async (c: SupabaseClient) => {
      const { error } = await c.from('alert_settings').select('event_key').limit(1);
      return error ? { error } : null;
    });

  for (let attempt = 1; attempt <= retries; attempt++) {
    let result: { error: unknown } | null;
    try {
      result = await probe(client);
    } catch (err) {
      result = { error: err };
    }
    if (!result) {
      log.info('Supabase configured — persistence is durable across redeploys.');
      return supabaseRepositories(client);
    }
    log.warn(
      { attempt, retries, err: errMessage(result.error) },
      'Supabase configured but not ready (missing schema or stale cache) — retrying',
    );
    if (attempt < retries) await sleep(delayMs);
  }

  log.error(
    'Supabase is configured but unreachable or not migrated after multiple attempts. ' +
      'Did you run src/db/schema.sql in your Supabase SQL editor? Falling back to ' +
      'IN-MEMORY persistence for this boot (data is NOT durable). Fix the schema or ' +
      'credentials and redeploy to restore durability.',
  );
  return inMemoryRepositories();
}

export * from './config.js';
export * from './liveState.js';
export * from './events.js';
export * from './sessions.js';
export * from './adminUsers.js';
export * from './alertSettings.js';
