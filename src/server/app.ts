/**
 * Express application bootstrap (masterdoc §5, §8).
 *
 * Phase 6 layers the dashboard backend onto the same app: security headers,
 * rate limiting, the public status + setup routes, the three-layer auth guard,
 * and the protected `/api/*` surface (dashboard data, config, control). The
 * React SPA is served in Phase 7.
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { createServer, type Server } from 'node:http';
import helmet from 'helmet';
import { childLogger } from '../lib/logger.js';
import type { ApiDeps } from './deps.js';
import { requireAuth } from './auth/index.js';
import { createApiLimiter, createLoginLimiter } from './rateLimit.js';
import { createStatusRouter } from './routes/status.js';
import { createSetupRouter } from './routes/setup.js';
import { createAuthRouter } from './routes/auth.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createConfigRouter } from './routes/config.js';
import { createControlRouter } from './routes/control.js';
import { needsSetup } from './setupWizard.js';
import { asyncHandler } from './routes/asyncHandler.js';

const log = childLogger('server');

export function createApp(deps: ApiDeps): Express {
  const app = express();

  // Trust the platform proxy (Render/etc.) so client IPs are correct — needed
  // by the rate limiter and IP allowlist.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));

  // Public: status/health (UptimeRobot keep-alive target) and setup wizard.
  app.use('/', createStatusRouter(deps.state));
  app.use('/api/setup', createApiLimiter(), createSetupRouter(deps));

  // Auth endpoints (login is strictly rate-limited for brute-force lockout).
  const auth = createAuthRouter(deps);
  app.use('/api/auth/login', createLoginLimiter());
  app.use('/api/auth', createApiLimiter(), auth);

  // Protected API surface.
  const guard = requireAuth(() => deps.config.get());
  app.use('/api', createApiLimiter(), guard);
  app.use('/api', createDashboardRouter(deps));
  app.use('/api/config', createConfigRouter(deps));
  app.use('/api/control', createControlRouter(deps));

  // Root: a tiny setup-status placeholder until the SPA lands in Phase 7.
  app.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({
        name: 'NeoBot',
        dashboard: 'API only until Phase 7',
        needsSetup: await needsSetup(deps.repos),
      });
    }),
  );

  // JSON error handler (async route rejections land here).
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    log.error({ err }, 'Unhandled request error');
    if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
  });

  return app;
}

/** Start the HTTP server on the given port. Returns the server for shutdown. */
export function startServer(app: Express, port: number): Server {
  const server = createServer(app);
  server.listen(port, () => {
    log.info({ port }, 'HTTP server listening (dashboard API + /status.json)');
  });
  return server;
}
