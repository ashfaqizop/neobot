import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { makeApiDeps } from '../support/serverDeps.js';

describe('alerts API (masterdoc §11)', () => {
  it('requires auth, lists toggles, and persists a mute', async () => {
    const deps = makeApiDeps();
    await deps.repos.alertSettings.ensureDefaults(['connected', 'banned']);
    const app = createApp(deps);

    // Unauthenticated is rejected.
    expect((await request(app).get('/api/alerts')).status).toBe(401);

    // Authenticate.
    await request(app).post('/api/setup').send({ admin: { username: 'admin', password: 'hunter2!' } });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'hunter2!' });

    // List (all-on by default).
    let res = await agent.get('/api/alerts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((a: { enabled: boolean }) => a.enabled)).toBe(true);

    // Mute one, and confirm it persisted.
    res = await agent.put('/api/alerts').send({ eventKey: 'connected', enabled: false });
    expect(res.status).toBe(200);

    res = await agent.get('/api/alerts');
    const connected = res.body.find((a: { eventKey: string }) => a.eventKey === 'connected');
    expect(connected.enabled).toBe(false);

    // Invalid payload is rejected.
    res = await agent.put('/api/alerts').send({ eventKey: 123 });
    expect(res.status).toBe(400);
  });
});
