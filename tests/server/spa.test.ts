/**
 * SPA serving (Phase 7). When a built dashboard exists, the app serves its
 * static assets and falls back to index.html for client-side routes — while
 * never hijacking the API surface or the public status endpoint.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { makeApiDeps } from '../support/serverDeps.js';

describe('SPA serving', () => {
  let spaDir: string;

  beforeAll(() => {
    spaDir = mkdtempSync(join(tmpdir(), 'neobot-spa-'));
    mkdirSync(join(spaDir, 'assets'), { recursive: true });
    writeFileSync(join(spaDir, 'index.html'), '<!doctype html><title>NeoBot</title><div id=root>');
    writeFileSync(join(spaDir, 'assets', 'app.js'), 'console.log("neobot");');
  });

  afterAll(() => rmSync(spaDir, { recursive: true, force: true }));

  const app = () => createApp(makeApiDeps(), { spaDir });

  it('serves index.html at the root', async () => {
    const res = await request(app()).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('id=root');
  });

  it('falls back to index.html for unknown client routes (deep links)', async () => {
    const res = await request(app()).get('/config');
    expect(res.status).toBe(200);
    expect(res.text).toContain('NeoBot');
  });

  it('serves hashed static assets', async () => {
    const res = await request(app()).get('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.text).toContain('neobot');
  });

  it('never serves HTML for unknown API routes (stays JSON 401/404)', async () => {
    const res = await request(app()).get('/api/does-not-exist');
    expect(res.headers['content-type'] ?? '').not.toContain('text/html');
    expect(res.status).not.toBe(200);
  });

  it('keeps the public status endpoint intact', async () => {
    const res = await request(app()).get('/status.json');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).not.toHaveProperty('position');
  });
});
