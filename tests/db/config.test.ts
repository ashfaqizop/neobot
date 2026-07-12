import { describe, expect, it } from 'vitest';
import { InMemoryConfigRepository } from '../../src/db/repositories/config.js';
import { buildDefaultAppConfig } from '../../src/config/appConfig.js';
import { env } from '../../src/config/env.js';

describe('config repository — hybrid bootstrap (masterdoc §9)', () => {
  it('bootstraps from defaults on first run, then treats the stored row as source of truth', async () => {
    const repo = new InMemoryConfigRepository();
    expect(await repo.get()).toBeNull();

    const defaults = buildDefaultAppConfig(env);
    const first = await repo.getOrBootstrap(defaults);
    expect(first).toEqual(defaults);
    expect(await repo.get()).toEqual(defaults);

    // A second bootstrap with different defaults must NOT overwrite the stored row.
    const different = { ...defaults, connection: { ...defaults.connection, host: 'elsewhere.example' } };
    const second = await repo.getOrBootstrap(different);
    expect(second.connection.host).toBe(defaults.connection.host);
  });

  it('save overwrites the stored config', async () => {
    const repo = new InMemoryConfigRepository();
    const cfg = buildDefaultAppConfig(env);
    await repo.save(cfg);
    await repo.save({ ...cfg, connection: { ...cfg.connection, port: 12345 } });
    expect((await repo.get())?.connection.port).toBe(12345);
  });
});
