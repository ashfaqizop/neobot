/**
 * Live-state repository (masterdoc §9).
 *
 * Persists the current status snapshot so the dashboard doesn't lose "current
 * status" across a mid-session container restart. Singleton row (id = 1).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { StateSnapshot } from '../../bot/state.js';
import type { LiveStateRepository } from '../types.js';

const STATE_ID = 1;

export class InMemoryLiveStateRepository implements LiveStateRepository {
  private snapshot: StateSnapshot | null = null;

  load(): Promise<StateSnapshot | null> {
    return Promise.resolve(this.snapshot);
  }

  save(snapshot: StateSnapshot): Promise<void> {
    this.snapshot = snapshot;
    return Promise.resolve();
  }
}

export class SupabaseLiveStateRepository implements LiveStateRepository {
  constructor(private readonly client: SupabaseClient) {}

  async load(): Promise<StateSnapshot | null> {
    const { data, error } = await this.client
      .from('live_state')
      .select('data')
      .eq('id', STATE_ID)
      .maybeSingle();
    if (error) throw new Error(`live_state.load failed: ${error.message}`);
    return (data?.data as StateSnapshot | undefined) ?? null;
  }

  async save(snapshot: StateSnapshot): Promise<void> {
    const { error } = await this.client.from('live_state').upsert(
      {
        id: STATE_ID,
        status: snapshot.status,
        current_activity: snapshot.currentActivity,
        last_updated: snapshot.lastUpdated,
        data: snapshot,
      },
      { onConflict: 'id' },
    );
    if (error) throw new Error(`live_state.save failed: ${error.message}`);
  }
}
