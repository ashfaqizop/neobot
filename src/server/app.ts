/**
 * Express application bootstrap (masterdoc §5, §8).
 *
 * Phase 2 keeps this minimal: JSON parsing plus the public status/health
 * routes. Later phases layer on top of the SAME app without a rewrite:
 *   - Phase 6: auth (login/password, token URL, IP allowlist), rate limiting,
 *     the setup wizard, `/api/*` routes, and Socket.IO.
 *   - Phase 7: serving the built React dashboard.
 */
import express, { type Express } from 'express';
import { createServer, type Server } from 'node:http';
import { childLogger } from '../lib/logger.js';
import type { LiveStateStore } from '../bot/state.js';
import { createStatusRouter } from './routes/status.js';

const log = childLogger('server');

export interface AppDeps {
  state: LiveStateStore;
}

export function createApp(deps: AppDeps): Express {
  const app = express();

  // Trust the platform proxy (Render/etc.) so client IPs are correct — needed
  // by the rate limiter and IP allowlist in Phase 6.
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // Public, unauthenticated status & health endpoints.
  app.use('/', createStatusRouter(deps.state));

  return app;
}

/** Start the HTTP server on the given port. Returns the server for shutdown. */
export function startServer(app: Express, port: number): Server {
  const server = createServer(app);
  server.listen(port, () => {
    log.info({ port }, 'HTTP server listening (/status.json, /healthz)');
  });
  return server;
}
