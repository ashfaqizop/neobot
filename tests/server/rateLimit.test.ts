import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { makeApiDeps } from '../support/serverDeps.js';

describe('login rate limiting (masterdoc §8.2)', () => {
  it('locks out after too many login attempts (429)', async () => {
    const app = createApp(makeApiDeps());
    let last = 0;
    // The login limiter allows 5 per window; the 6th+ should be 429.
    for (let i = 0; i < 7; i++) {
      const res = await request(app).post('/api/auth/login').send({ username: 'x', password: 'y' });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
