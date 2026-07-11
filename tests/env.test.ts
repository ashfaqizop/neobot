import { describe, expect, it } from 'vitest';
import { __loadEnvForTest } from '../src/config/env.js';

/**
 * Phase 1 smoke test: proves the Vitest pipeline runs and that env resolution
 * behaves — sensible defaults, graceful degradation, and validation errors.
 */
describe('env resolution', () => {
  it('applies defaults with an empty environment (graceful boot)', () => {
    const env = __loadEnvForTest({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.MC_PORT).toBe(25565);
    expect(env.SELF_PING_ENABLED).toBe(false);
    expect(env.SUPABASE_URL).toBeUndefined();
    expect(env.DISCORD_BOT_TOKEN).toBeUndefined();
  });

  it('coerces numeric and boolean-ish strings', () => {
    const env = __loadEnvForTest({ PORT: '8080', SELF_PING_ENABLED: 'true', MC_PORT: '25566' });
    expect(env.PORT).toBe(8080);
    expect(env.MC_PORT).toBe(25566);
    expect(env.SELF_PING_ENABLED).toBe(true);
  });

  it('rejects an invalid value with a helpful error', () => {
    expect(() => __loadEnvForTest({ NODE_ENV: 'staging' })).toThrow(
      /Invalid environment configuration/,
    );
  });
});
