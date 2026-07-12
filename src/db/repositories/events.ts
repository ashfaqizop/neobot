/**
 * Events repository (masterdoc §9).
 *
 * Structured event log mirrored to Supabase (the dashboard log viewer reads it
 * in Phase 6/7). The in-memory fallback keeps a bounded ring so `recent()`
 * works without Supabase.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventInput, EventRecord, EventsRepository } from '../types.js';

const DEFAULT_LIMIT = 100;
const MAX_MEMORY = 500;

export class InMemoryEventsRepository implements EventsRepository {
  private readonly ring: EventRecord[] = [];
  private nextId = 1;

  append(event: EventInput): Promise<void> {
    this.ring.push({ ...event, id: this.nextId++, createdAt: new Date().toISOString() });
    if (this.ring.length > MAX_MEMORY) this.ring.shift();
    return Promise.resolve();
  }

  recent(limit = DEFAULT_LIMIT): Promise<EventRecord[]> {
    return Promise.resolve(this.ring.slice(-limit).reverse());
  }
}

export class SupabaseEventsRepository implements EventsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async append(event: EventInput): Promise<void> {
    const { error } = await this.client.from('events').insert({
      level: event.level,
      category: event.category,
      message: event.message,
      meta: event.meta ?? null,
    });
    if (error) throw new Error(`events.append failed: ${error.message}`);
  }

  async recent(limit = DEFAULT_LIMIT): Promise<EventRecord[]> {
    const { data, error } = await this.client
      .from('events')
      .select('id, created_at, level, category, message, meta')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`events.recent failed: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id as number,
      createdAt: row.created_at as string,
      level: row.level as EventRecord['level'],
      category: row.category as string,
      message: row.message as string,
      meta: (row.meta as Record<string, unknown> | null) ?? undefined,
    }));
  }
}
