/**
 * Alert settings repository (masterdoc §9, §11).
 *
 * Per-event alert toggles, defaulting to all-on. Built here; consumed by the
 * Phase 8 Discord alert dispatcher and the dashboard's alert toggles.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AlertSetting, AlertSettingsRepository } from '../types.js';

export class InMemoryAlertSettingsRepository implements AlertSettingsRepository {
  private readonly settings = new Map<string, boolean>();

  list(): Promise<AlertSetting[]> {
    return Promise.resolve([...this.settings].map(([eventKey, enabled]) => ({ eventKey, enabled })));
  }

  setEnabled(eventKey: string, enabled: boolean): Promise<void> {
    this.settings.set(eventKey, enabled);
    return Promise.resolve();
  }

  ensureDefaults(eventKeys: string[]): Promise<void> {
    for (const key of eventKeys) {
      if (!this.settings.has(key)) this.settings.set(key, true);
    }
    return Promise.resolve();
  }
}

export class SupabaseAlertSettingsRepository implements AlertSettingsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<AlertSetting[]> {
    const { data, error } = await this.client.from('alert_settings').select('event_key, enabled');
    if (error) throw new Error(`alert_settings.list failed: ${error.message}`);
    return (data ?? []).map((row) => ({
      eventKey: row.event_key as string,
      enabled: (row.enabled as boolean | null) ?? true,
    }));
  }

  async setEnabled(eventKey: string, enabled: boolean): Promise<void> {
    const { error } = await this.client
      .from('alert_settings')
      .upsert({ event_key: eventKey, enabled }, { onConflict: 'event_key' });
    if (error) throw new Error(`alert_settings.setEnabled failed: ${error.message}`);
  }

  async ensureDefaults(eventKeys: string[]): Promise<void> {
    if (eventKeys.length === 0) return;
    // Insert missing keys as enabled; ignore ones that already exist.
    const rows = eventKeys.map((event_key) => ({ event_key, enabled: true }));
    const { error } = await this.client
      .from('alert_settings')
      .upsert(rows, { onConflict: 'event_key', ignoreDuplicates: true });
    if (error) throw new Error(`alert_settings.ensureDefaults failed: ${error.message}`);
  }
}
