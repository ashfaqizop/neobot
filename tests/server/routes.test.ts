import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { makeApiDeps } from '../support/serverDeps.js';

describe('dashboard API flow (masterdoc §8)', () => {
  it('walks setup → login → protected → control → export → logout', async () => {
    const deps = makeApiDeps();
    const app = createApp(deps);

    // Before setup.
    let res = await request(app).get('/api/setup/status');
    expect(res.status).toBe(200);
    expect(res.body.needsSetup).toBe(true);

    // Protected route rejects unauthenticated.
    res = await request(app).get('/api/state');
    expect(res.status).toBe(401);

    // Run setup.
    res = await request(app)
      .post('/api/setup')
      .send({ admin: { username: 'admin', password: 'hunter2!' }, connection: { host: 'mc.x', username: 'NeoBot' } });
    expect(res.status).toBe(201);

    // Second setup is refused.
    res = await request(app).post('/api/setup').send({ admin: { username: 'a', password: 'hunter2!' } });
    expect(res.status).toBe(409);

    // Wrong password.
    res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'nope' });
    expect(res.status).toBe(401);

    // Correct login via a cookie-preserving agent.
    const agent = request.agent(app);
    res = await agent.post('/api/auth/login').send({ username: 'admin', password: 'hunter2!' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('admin');

    // Protected state now works and includes the RAM widget.
    res = await agent.get('/api/state');
    expect(res.status).toBe(200);
    expect(res.body.resource.rssBytes).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('safeMode');

    // Control action reaches the controller.
    res = await agent.post('/api/control/pause');
    expect(res.status).toBe(200);
    expect(deps.controls.engine.setManualPause).toHaveBeenCalledWith(true);

    // Config export.
    res = await agent.get('/api/config/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('neobot-config.json');
    expect(res.body.connection.host).toBe('mc.x');

    // Logout invalidates the session.
    await agent.post('/api/auth/logout');
    res = await agent.get('/api/state');
    expect(res.status).toBe(401);
  });

  it('config import round-trips a valid config', async () => {
    const deps = makeApiDeps();
    const app = createApp(deps);
    await request(app)
      .post('/api/setup')
      .send({ admin: { username: 'admin', password: 'hunter2!' } });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'hunter2!' });

    const current = deps.config.get();
    const updated = { ...current, connection: { ...current.connection, port: 12321 } };
    const res = await agent.post('/api/config/import').send(updated);
    expect(res.status).toBe(200);
    expect(deps.config.get().connection.port).toBe(12321);
  });
});
