import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server/app.js';
import { makeApiDeps } from './support/serverDeps.js';

describe('status routes (public, no auth — masterdoc §10)', () => {
  const deps = makeApiDeps();
  const state = deps.state;
  const app = createApp(deps);

  it('GET /status.json returns 200 and the §10 payload shape', async () => {
    const res = await request(app).get('/status.json');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: expect.any(String),
      uptimePercent: expect.any(Number),
      version: expect.any(String),
      lastUpdated: expect.any(String),
    });
    // currentActivity may be null; the key must exist.
    expect(res.body).toHaveProperty('currentActivity');
  });

  it('GET /status.json reflects live status changes', async () => {
    state.setStatus('connected', 'wandering');
    const res = await request(app).get('/status.json');
    expect(res.body.status).toBe('connected');
    expect(res.body.currentActivity).toBe('wandering');
  });

  it('GET /healthz returns 200 { ok: true }', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('GET /badge.json returns the Shields.io endpoint schema (§18.11)', async () => {
    state.setStatus('connected', 'wandering');
    const res = await request(app).get('/badge.json');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      schemaVersion: 1,
      label: 'neobot',
      message: 'connected',
      color: 'brightgreen',
    });
  });

  it('GET /badge.json colors a degraded status red', async () => {
    state.setStatus('banned', null);
    const res = await request(app).get('/badge.json');
    expect(res.body).toMatchObject({ message: 'banned', color: 'red' });
  });
});
