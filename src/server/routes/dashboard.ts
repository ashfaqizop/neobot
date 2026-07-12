/**
 * Dashboard data routes (masterdoc §8.4). Protected by requireAuth (mounted in
 * app.ts). Provides the live snapshot (incl. RAM), event log tail, and sessions.
 */
import { Router } from 'express';
import type { ApiDeps } from '../deps.js';
import { asyncHandler } from './asyncHandler.js';

function clampLimit(raw: unknown, fallback: number, max: number): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN;
  if (Number.isNaN(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

export function createDashboardRouter(deps: ApiDeps): Router {
  const router = Router();

  router.get('/state', (_req, res) => {
    res.json(deps.controller.snapshot());
  });

  router.get(
    '/logs',
    asyncHandler(async (req, res) => {
      const limit = clampLimit(req.query.limit, 100, 500);
      res.json(await deps.repos.events.recent(limit));
    }),
  );

  router.get(
    '/sessions',
    asyncHandler(async (req, res) => {
      const limit = clampLimit(req.query.limit, 50, 200);
      res.json(await deps.repos.sessions.recent(limit));
    }),
  );

  return router;
}
