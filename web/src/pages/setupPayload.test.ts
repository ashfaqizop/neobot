import { describe, expect, it } from 'vitest';
import { buildSetupPayload, defaultSetupForm, validateStep, type SetupForm } from './setupPayload.ts';

describe('buildSetupPayload', () => {
  it('maps a filled form to the setupSchema shape', () => {
    const form: SetupForm = {
      ...defaultSetupForm,
      adminUsername: '  admin ',
      adminPassword: 'secret1',
      adminPasswordConfirm: 'secret1',
      host: ' play.example.net ',
      port: '25577',
      autoDetectVersion: false,
      version: '1.20.4',
      botUsername: 'NeoBot',
      safeX: '10',
      safeY: '',
      safeZ: '-20',
      safeRadius: '48',
      blockMode: 'radius-any',
      boundless: true,
      chatEnabled: true,
      chatMessages: 'hello\n  world  \n\n',
      tokenUrlEnabled: true,
      ipAllowlistEnabled: true,
      ipAllowlistEntries: '203.0.113.4, 198.51.100.9',
    };

    const payload = buildSetupPayload(form);
    expect(payload.admin).toEqual({ username: 'admin', password: 'secret1' });
    expect(payload.connection).toEqual({
      host: 'play.example.net',
      port: 25577,
      version: '1.20.4',
      username: 'NeoBot',
    });
    expect(payload.safeZone).toEqual({ x: 10, y: null, z: -20, radius: 48 });
    expect(payload.blockInteraction).toEqual({ mode: 'radius-any', boundless: true });
    expect(payload.chat).toEqual({ enabled: true, messages: ['hello', 'world'] });
    expect(payload.auth.tokenUrl.enabled).toBe(true);
    expect(payload.auth.ipAllowlist).toEqual({
      enabled: true,
      entries: ['203.0.113.4', '198.51.100.9'],
    });
  });

  it('nulls empty optionals and auto-detects version', () => {
    const payload = buildSetupPayload({
      ...defaultSetupForm,
      adminUsername: 'a',
      adminPassword: 'secret1',
      adminPasswordConfirm: 'secret1',
    });
    expect(payload.connection.host).toBeNull();
    expect(payload.connection.version).toBeNull();
    expect(payload.connection.username).toBeNull();
    expect(payload.safeZone.x).toBeNull();
  });
});

describe('validateStep', () => {
  const base = { ...defaultSetupForm, adminUsername: 'admin', adminPassword: 'secret1', adminPasswordConfirm: 'secret1' };

  it('rejects short/mismatched passwords on the admin step', () => {
    expect(validateStep(0, { ...base, adminPassword: 'x', adminPasswordConfirm: 'x' })).toMatch(/6 characters/);
    expect(validateStep(0, { ...base, adminPasswordConfirm: 'nope' })).toMatch(/do not match/);
    expect(validateStep(0, base)).toBeNull();
  });

  it('rejects a bad port and blank pinned version on the connection step', () => {
    expect(validateStep(1, { ...base, port: '70000' })).toMatch(/valid port/);
    expect(validateStep(1, { ...base, autoDetectVersion: false, version: '' })).toMatch(/auto-detect/);
    expect(validateStep(1, base)).toBeNull();
  });
});
