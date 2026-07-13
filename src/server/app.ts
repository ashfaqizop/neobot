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
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
import { createAlertsRouter } from './routes/alerts.js';
import { needsSetup } from './setupWizard.js';
import { asyncHandler } from './routes/asyncHandler.js';

const log = childLogger('server');

export interface CreateAppOptions {
  /** Directory of the built SPA. Defaults to `web/dist`; injectable for tests. */
  spaDir?: string;
}

export function createApp(deps: ApiDeps, opts: CreateAppOptions = {}): Express {
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
  app.use('/api/alerts', createAlertsRouter(deps));

  // Serve the React dashboard SPA (Phase 7) when it's been built. The static
  // assets are hashed by Vite; every other (non-API) GET falls back to
  // index.html so client-side routing works on deep links / refresh. Guarded by
  // an existence check so API-only runs and tests behave as before.
  const spaDir = opts.spaDir ?? resolve(process.cwd(), 'web', 'dist');
  if (existsSync(join(spaDir, 'index.html'))) {
    app.use(express.static(spaDir, { index: false, maxAge: '1h' }));
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Never hijack the API surface or the Socket.IO transport; let unknown
      // /api/* fall through to the 404/error handling instead of serving HTML.
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        next();
        return;
      }
      res.sendFile(join(spaDir, 'index.html'), (err) => {
        if (err) next(err);
      });
    });
  } else {
    // No SPA build present: keep the tiny setup-status placeholder at the root.
    app.get(
      '/',
      asyncHandler(async (_req, res) => {
        res.json({
          name: 'NeoBot',
          dashboard: 'run `npm run build` to bundle the dashboard UI',
          needsSetup: await needsSetup(deps.repos),
        });
      }),
    );
  }

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
