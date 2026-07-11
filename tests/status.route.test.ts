import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server/app.js';
import { LiveStateStore } from '../src/bot/state.js';

describe('status routes (public, no auth — masterdoc §10)', () => {
  const state = new LiveStateStore();
  const app = createApp({ state });

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
});
