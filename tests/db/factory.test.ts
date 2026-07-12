import { describe, expect, it } from 'vitest';
import { createRepositories, InMemoryConfigRepository } from '../../src/db/repositories/index.js';

describe('repository factory', () => {
  it('falls back to in-memory repositories when Supabase is unconfigured', () => {
    // The test environment has no SUPABASE_URL/KEY set.
    const repos = createRepositories();
    expect(repos.config).toBeInstanceOf(InMemoryConfigRepository);
    // Sanity: the whole set is present.
    for (const key of ['config', 'liveState', 'events', 'sessions', 'adminUsers', 'alertSettings'] as const) {
      expect(repos[key]).toBeDefined();
    }
  });
});
