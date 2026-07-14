import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { io as ioClient, type Socket } from 'socket.io-client';
import { LiveStateStore } from '../../src/bot/state.js';
import { BehaviorEngine } from '../../src/bot/behaviorEngine.js';
import { ConnectionManager } from '../../src/bot/connection.js';
import { BotController } from '../../src/bot/controller.js';
import { createApp, startServer } from '../../src/server/app.js';
import { attachSocket } from '../../src/server/socket.js';
import { createRepositories } from '../../src/db/repositories/index.js';
import { buildDefaultAppConfig, type AppConfig } from '../../src/config/appConfig.js';
import { env } from '../../src/config/env.js';
import { waitFor } from './support/wait.js';

/**
 * The real Express app + Socket.IO bridge, booted on an ephemeral port and
 * driven over real HTTP — no supertest shims. Exercises the whole dashboard
 * lifecycle: public status, setup wizard, auth/session, protected control, rate
 * limiting, and live-state push.
 */
describe('dashboard HTTP + Socket.IO (live boot)', () => {
  let server: Server;
  let base: string;
  let state: LiveStateStore;
  let sessionCookie = '';

  const ADMIN = { username: 'liveadmin', password: 'sup3r-secret' };

  beforeAll(async () => {
    state = new LiveStateStore();
    const repos = createRepositories();
    let config: AppConfig = buildDefaultAppConfig(env);
    const configHolder = { get: () => config, set: (c: AppConfig) => (config = c) };
    const engine = new BehaviorEngine(state, config.behavior);
    // Bot intentionally idle (no target) — the HTTP/dashboard surface is what's
    // under test here; it must serve fully regardless of bot state.
    const connection = new ConnectionManager(state, { getConfig: () => null });
    const controller = new BotController(connection, engine, state);
    const app = createApp({ state, repos, controller, config: configHolder });
    server = startServer(app, 0);
    attachSocket(server, { state, getConfig: () => config });
    if (!server.listening) await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server?.close();
  });

  const get = (path: string, cookie = '') =>
    fetch(base + path, { headers: cookie ? { cookie } : {} });
  const post = (path: string, body: unknown, cookie = '') =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    });

  it('serves public health + status endpoints', async () => {
    const health = await get('/healthz');
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true });

    const status = await get('/status.json');
    expect(status.status).toBe(200);
    const body = (await status.json()) as { status: string; version: string };
    expect(body.status).toBeTruthy();
    expect(body.version).toBeTruthy();
  });

  it('reports needsSetup, then completes the setup wizard', async () => {
    const before = (await (await get('/api/setup/status')).json()) as { needsSetup: boolean };
    expect(before.needsSetup).toBe(true);

    const res = await post('/api/setup', { admin: ADMIN });
    expect(res.status).toBe(201);

    const after = (await (await get('/api/setup/status')).json()) as { needsSetup: boolean };
    expect(after.needsSetup).toBe(false);

    // Re-running setup is rejected once configured.
    const dup = await post('/api/setup', { admin: ADMIN });
    expect(dup.status).toBe(409);
  });

  it('rejects protected routes without a session', async () => {
    const res = await get('/api/state');
    expect(res.status).toBe(401);
  });

  it('logs in, sets a session cookie, and unlocks the protected API', async () => {
    const bad = await post('/api/auth/login', { username: ADMIN.username, password: 'wrong' });
    expect(bad.status).toBe(401);

    const good = await post('/api/auth/login', ADMIN);
    expect(good.status).toBe(200);
    const setCookie = good.headers.getSetCookie().find((c) => c.startsWith('neobot_session='));
    expect(setCookie).toBeTruthy();
    sessionCookie = setCookie!.split(';')[0]!;

    const me = await get('/api/auth/me', sessionCookie);
    expect(me.status).toBe(200);
    expect(((await me.json()) as { username: string }).username).toBe(ADMIN.username);

    const stateRes = await get('/api/state', sessionCookie);
    expect(stateRes.status).toBe(200);
  });

  it('drives the bot controller through protected control routes', async () => {
    const pause = await post('/api/control/pause', {}, sessionCookie);
    expect(pause.status).toBe(200);
    expect((await pause.json()) as { paused: boolean }).toMatchObject({ paused: true });

    const resume = await post('/api/control/resume', {}, sessionCookie);
    expect(resume.status).toBe(200);

    const safe = await post('/api/control/safe-mode', { enabled: true }, sessionCookie);
    expect(safe.status).toBe(200);
    expect((await safe.json()) as { safeMode: boolean }).toMatchObject({ safeMode: true });
  });

  it('pushes live-state updates over Socket.IO to an authed client', async () => {
    const socket: Socket = ioClient(base, {
      transports: ['polling'],
      extraHeaders: { cookie: sessionCookie },
    });
    const received: Array<{ status: string }> = [];
    socket.on('state', (p: { status: string }) => received.push(p));

    try {
      await waitFor(() => socket.connected, { timeoutMs: 8_000, label: 'socket connect' });
      // Initial snapshot on connect.
      await waitFor(() => received.length >= 1, { timeoutMs: 8_000, label: 'initial state' });

      // A live change must be pushed to the connected client.
      state.setStatus('connected', 'idle');
      await waitFor(() => received.some((p) => p.status === 'connected'), {
        timeoutMs: 8_000,
        label: 'pushed state update',
      });
    } finally {
      socket.disconnect();
    }
  });

  it('rate-limits repeated failed logins with a 429 lockout', async () => {
    let sawLockout = false;
    for (let i = 0; i < 12; i++) {
      const res = await post('/api/auth/login', { username: 'nobody', password: 'nope' });
      if (res.status === 429) {
        sawLockout = true;
        break;
      }
    }
    expect(sawLockout).toBe(true);
  });
});
