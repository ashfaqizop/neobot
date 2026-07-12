/**
 * Sessions repository (masterdoc §9).
 *
 * One row per connect→disconnect lifecycle, so uptime history survives redeploys.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionRow, SessionsRepository } from '../types.js';

const DEFAULT_LIMIT = 50;

export class InMemorySessionsRepository implements SessionsRepository {
  private readonly rows: SessionRow[] = [];
  private nextId = 1;

  start(connectedAt: string): Promise<number> {
    const id = this.nextId++;
    this.rows.push({ id, connectedAt, disconnectedAt: null, disconnectReason: null });
    return Promise.resolve(id);
  }

  end(id: number, disconnectedAt: string, reason: string | null): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) {
      row.disconnectedAt = disconnectedAt;
      row.disconnectReason = reason;
    }
    return Promise.resolve();
  }

  recent(limit = DEFAULT_LIMIT): Promise<SessionRow[]> {
    return Promise.resolve(this.rows.slice(-limit).reverse());
  }
}

export class SupabaseSessionsRepository implements SessionsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async start(connectedAt: string): Promise<number> {
    const { data, error } = await this.client
      .from('sessions')
      .insert({ connected_at: connectedAt })
      .select('id')
      .single();
    if (error) throw new Error(`sessions.start failed: ${error.message}`);
    return data.id as number;
  }

  async end(id: number, disconnectedAt: string, reason: string | null): Promise<void> {
    const { error } = await this.client
      .from('sessions')
      .update({ disconnected_at: disconnectedAt, disconnect_reason: reason })
      .eq('id', id);
    if (error) throw new Error(`sessions.end failed: ${error.message}`);
  }

  async recent(limit = DEFAULT_LIMIT): Promise<SessionRow[]> {
    const { data, error } = await this.client
      .from('sessions')
      .select('id, connected_at, disconnected_at, disconnect_reason')
      .order('connected_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`sessions.recent failed: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id as number,
      connectedAt: row.connected_at as string,
      disconnectedAt: (row.disconnected_at as string | null) ?? null,
      disconnectReason: (row.disconnect_reason as string | null) ?? null,
    }));
  }
}
