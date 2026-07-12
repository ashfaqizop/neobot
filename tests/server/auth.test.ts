import { describe, expect, it } from 'vitest';
import { signSession, verifySession, SESSION_COOKIE } from '../../src/server/auth/session.js';
import { isIpAllowed } from '../../src/server/auth/ipAllowlist.js';
import { hashPassword, verifyPassword } from '../../src/server/auth/password.js';
import { authorize } from '../../src/server/auth/index.js';
import { buildDefaultAppConfig, type AppConfig } from '../../src/config/appConfig.js';
import { env } from '../../src/config/env.js';

describe('session tokens', () => {
  it('signs and verifies a username', () => {
    const token = signSession('admin');
    expect(verifySession(token)).toBe('admin');
  });

  it('rejects tampered, garbage, and expired tokens', () => {
    expect(verifySession('not-a-token')).toBeNull();
    expect(verifySession(`${signSession('admin')}x`)).toBeNull();
    expect(verifySession(signSession('admin', -1000))).toBeNull(); // expired
    expect(verifySession(undefined)).toBeNull();
  });
});

describe('isIpAllowed', () => {
  it('matches exact and IPv4-mapped IPv6 addresses', () => {
    expect(isIpAllowed('1.2.3.4', ['1.2.3.4'])).toBe(true);
    expect(isIpAllowed('::ffff:1.2.3.4', ['1.2.3.4'])).toBe(true);
    expect(isIpAllowed('1.2.3.5', ['1.2.3.4'])).toBe(false);
    expect(isIpAllowed(undefined, ['1.2.3.4'])).toBe(false);
  });
});

describe('password hashing (bcrypt)', () => {
  it('verifies the correct password only', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword('correct horse', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('authorize composition (masterdoc §8.2)', () => {
  const base: AppConfig = buildDefaultAppConfig(env);
  const cookie = (t: string): string => `${SESSION_COOKIE}=${t}`;

  it('denies with no session and no token', () => {
    expect(authorize({ ip: '1.2.3.4', cookieHeader: undefined, token: undefined }, base).status).toBe(401);
  });

  it('allows a valid session', () => {
    const token = signSession('admin');
    expect(authorize({ ip: '1.2.3.4', cookieHeader: cookie(token), token: undefined }, base).ok).toBe(true);
  });

  it('allows a valid access token only when that layer is enabled', () => {
    const withToken: AppConfig = {
      ...base,
      auth: { ...base.auth, tokenUrl: { enabled: true, token: 'shhh' } },
    };
    expect(authorize({ ip: 'x', cookieHeader: undefined, token: 'shhh' }, withToken).ok).toBe(true);
    expect(authorize({ ip: 'x', cookieHeader: undefined, token: 'nope' }, withToken).status).toBe(401);
    // Same token is ignored when the layer is off.
    expect(authorize({ ip: 'x', cookieHeader: undefined, token: 'shhh' }, base).status).toBe(401);
  });

  it('applies the IP allowlist on top of a valid session', () => {
    const withIp: AppConfig = {
      ...base,
      auth: { ...base.auth, ipAllowlist: { enabled: true, entries: ['9.9.9.9'] } },
    };
    const token = signSession('admin');
    expect(authorize({ ip: '1.2.3.4', cookieHeader: cookie(token), token: undefined }, withIp).status).toBe(403);
    expect(authorize({ ip: '9.9.9.9', cookieHeader: cookie(token), token: undefined }, withIp).ok).toBe(true);
  });
});
