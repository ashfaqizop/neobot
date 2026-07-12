/**
 * Repository factory (masterdoc §9).
 *
 * Returns Supabase-backed repositories when Supabase is configured, otherwise a
 * fully in-memory set — so NeoBot behaves identically (just non-durable) with
 * zero credentials.
 */
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

export function createRepositories(): Repositories {
  const client = getSupabaseClient();

  if (!client) {
    log.warn('Supabase not configured — using in-memory persistence (data is lost on restart).');
    return {
      config: new InMemoryConfigRepository(),
      liveState: new InMemoryLiveStateRepository(),
      events: new InMemoryEventsRepository(),
      sessions: new InMemorySessionsRepository(),
      adminUsers: new InMemoryAdminUsersRepository(),
      alertSettings: new InMemoryAlertSettingsRepository(),
    };
  }

  log.info('Supabase configured — persistence is durable across redeploys.');
  return {
    config: new SupabaseConfigRepository(client),
    liveState: new SupabaseLiveStateRepository(client),
    events: new SupabaseEventsRepository(client),
    sessions: new SupabaseSessionsRepository(client),
    adminUsers: new SupabaseAdminUsersRepository(client),
    alertSettings: new SupabaseAlertSettingsRepository(client),
  };
}

export * from './config.js';
export * from './liveState.js';
export * from './events.js';
export * from './sessions.js';
export * from './adminUsers.js';
export * from './alertSettings.js';
