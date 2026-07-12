/**
 * Config repository (masterdoc §9 hybrid bootstrap flow).
 *
 * First run: no row exists → persist the env-derived defaults and return them.
 * Thereafter: the stored row is the live source of truth (the setup wizard in
 * Phase 6 writes to it; env changes no longer override it).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from '../../config/appConfig.js';
import type { ConfigRepository } from '../types.js';

const CONFIG_ID = 1;

export class InMemoryConfigRepository implements ConfigRepository {
  private stored: AppConfig | null = null;

  get(): Promise<AppConfig | null> {
    return Promise.resolve(this.stored);
  }

  save(config: AppConfig): Promise<void> {
    this.stored = config;
    return Promise.resolve();
  }

  getOrBootstrap(defaults: AppConfig): Promise<AppConfig> {
    this.stored ??= defaults;
    return Promise.resolve(this.stored);
  }
}

export class SupabaseConfigRepository implements ConfigRepository {
  constructor(private readonly client: SupabaseClient) {}

  async get(): Promise<AppConfig | null> {
    const { data, error } = await this.client
      .from('config')
      .select('data')
      .eq('id', CONFIG_ID)
      .maybeSingle();
    if (error) throw new Error(`config.get failed: ${error.message}`);
    return (data?.data as AppConfig | undefined) ?? null;
  }

  async save(config: AppConfig): Promise<void> {
    const { error } = await this.client
      .from('config')
      .upsert({ id: CONFIG_ID, data: config, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw new Error(`config.save failed: ${error.message}`);
  }

  async getOrBootstrap(defaults: AppConfig): Promise<AppConfig> {
    const existing = await this.get();
    if (existing) return existing;
    await this.save(defaults);
    return defaults;
  }
}
