import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveReadyRepositories,
  InMemoryAlertSettingsRepository,
  SupabaseAlertSettingsRepository,
} from '../../src/db/repositories/index.js';

/**
 * Boot resilience (masterdoc "always boots"): a configured-but-broken Supabase
 * must degrade to in-memory, never throw / crash-loop the process.
 */
describe('resolveReadyRepositories — Supabase boot resilience', () => {
  const fakeClient = {} as unknown as SupabaseClient; // never used (probe is injected)
  const noSleep = () => Promise.resolve();

  it('uses in-memory when Supabase is not configured (null client)', async () => {
    const repos = await resolveReadyRepositories(null);
    expect(repos.alertSettings).toBeInstanceOf(InMemoryAlertSettingsRepository);
  });

  it('uses Supabase when the readiness probe passes on the first try', async () => {
    const probe = vi.fn().mockResolvedValue(null);
    const sleep = vi.fn(noSleep);
    const repos = await resolveReadyRepositories(fakeClient, { probe, sleep });

    expect(repos.alertSettings).toBeInstanceOf(SupabaseAlertSettingsRepository);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a transient schema-cache error, then uses Supabase', async () => {
    const probe = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: 'Could not find the table in the schema cache' } })
      .mockResolvedValueOnce({ error: { message: 'still not ready' } })
      .mockResolvedValueOnce(null);
    const sleep = vi.fn(noSleep);

    const repos = await resolveReadyRepositories(fakeClient, { retries: 5, probe, sleep });

    expect(repos.alertSettings).toBeInstanceOf(SupabaseAlertSettingsRepository);
    expect(probe).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('falls back to in-memory (no throw) when the probe never succeeds', async () => {
    const probe = vi.fn().mockResolvedValue({ error: { message: 'missing schema' } });
    const sleep = vi.fn(noSleep);

    const repos = await resolveReadyRepositories(fakeClient, { retries: 4, probe, sleep });

    expect(repos.alertSettings).toBeInstanceOf(InMemoryAlertSettingsRepository);
    expect(probe).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3); // no sleep after the final attempt
  });

  it('treats a thrown/rejected probe as a failure and falls back', async () => {
    const probe = vi.fn().mockRejectedValue(new Error('network down'));
    const sleep = vi.fn(noSleep);

    const repos = await resolveReadyRepositories(fakeClient, { retries: 2, probe, sleep });

    expect(repos.alertSettings).toBeInstanceOf(InMemoryAlertSettingsRepository);
    expect(probe).toHaveBeenCalledTimes(2);
  });
});
