/**
 * Live-state → Supabase mirroring bridge (masterdoc §9).
 *
 * Subscribes to the in-memory `LiveStateStore` and mirrors changes durably:
 *   - `update` events → a debounced `live_state` upsert (so frequent activity
 *     changes don't hammer the free tier),
 *   - `session:start`/`session:end` → the `sessions` table, correlated by id.
 *
 * All writes are best-effort: a persistence failure logs but never disrupts the
 * bot (the in-memory state remains the working source of truth at runtime).
 */
import { childLogger } from '../lib/logger.js';
import type { LiveStateStore } from '../bot/state.js';
import type { Repositories } from './types.js';

const log = childLogger('persistence');
const SAVE_DEBOUNCE_MS = 3_000;

/** Wire the store to the repositories. Returns a detach function. */
export function attachStatePersistence(state: LiveStateStore, repos: Repositories): () => void {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let currentSessionId: number | null = null;

  const scheduleSave = (): void => {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void repos.liveState
        .save(state.getSnapshot())
        .catch((err: unknown) => log.warn({ err }, 'live_state save failed'));
    }, SAVE_DEBOUNCE_MS);
  };

  const onSessionStart = (payload: { connectedAt: string }): void => {
    void repos.sessions
      .start(payload.connectedAt)
      .then((id) => {
        currentSessionId = id;
      })
      .catch((err: unknown) => log.warn({ err }, 'sessions.start failed'));
  };

  const onSessionEnd = (payload: { disconnectedAt: string; reason: string | null }): void => {
    const id = currentSessionId;
    currentSessionId = null;
    if (id === null) return;
    void repos.sessions
      .end(id, payload.disconnectedAt, payload.reason)
      .catch((err: unknown) => log.warn({ err }, 'sessions.end failed'));
  };

  state.on('update', scheduleSave);
  state.on('session:start', onSessionStart);
  state.on('session:end', onSessionEnd);

  return () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    state.off('update', scheduleSave);
    state.off('session:start', onSessionStart);
    state.off('session:end', onSessionEnd);
  };
}
