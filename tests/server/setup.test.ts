import { describe, expect, it } from 'vitest';
import {
  buildAppConfigFromPayload,
  needsSetup,
  runSetup,
  SetupError,
  type SetupPayload,
} from '../../src/server/setupWizard.js';
import { createRepositories } from '../../src/db/repositories/index.js';

const payload: SetupPayload = {
  admin: { username: 'admin', password: 'hunter2!' },
  connection: { host: 'mc.example.com', port: 25566, username: 'NeoBot', version: null },
  blockInteraction: { mode: 'radius-any', boundless: false },
  chat: { enabled: true, messages: ['gm'] },
  auth: { tokenUrl: { enabled: true }, ipAllowlist: { enabled: true, entries: ['9.9.9.9'] } },
};

describe('setup wizard', () => {
  it('maps the payload onto AppConfig', () => {
    const cfg = buildAppConfigFromPayload(payload);
    expect(cfg.connection.host).toBe('mc.example.com');
    expect(cfg.connection.port).toBe(25566);
    expect(cfg.behavior.blockInteraction.mode).toBe('radius-any');
    expect(cfg.behavior.chat.enabled).toBe(true);
    expect(cfg.behavior.chat.messages).toEqual(['gm']);
    expect(cfg.behavior.behaviors.chat?.enabled).toBe(true);
    expect(cfg.auth.tokenUrl.enabled).toBe(true);
    expect(cfg.auth.tokenUrl.token).toBeTruthy(); // generated
    expect(cfg.auth.ipAllowlist.entries).toEqual(['9.9.9.9']);
  });

  it('creates the admin + config once, then refuses a second run', async () => {
    const repos = createRepositories();
    expect(await needsSetup(repos)).toBe(true);

    await runSetup(payload, repos);
    expect(await needsSetup(repos)).toBe(false);
    expect(await repos.adminUsers.count()).toBe(1);
    expect((await repos.config.get())?.connection.host).toBe('mc.example.com');

    await expect(runSetup(payload, repos)).rejects.toBeInstanceOf(SetupError);
  });
});
