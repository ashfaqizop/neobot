/**
 * Supabase client (masterdoc §9).
 *
 * Lazily creates a single client from env. Returns `null` when Supabase is not
 * configured — callers then fall back to in-memory repositories, preserving the
 * zero-credential boot.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasSupabase } from '../config/env.js';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (!client) {
    client = createClient(env.SUPABASE_URL as string, env.SUPABASE_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
