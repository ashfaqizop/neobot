/**
 * Public status & health routes (masterdoc §10).
 *
 * Both endpoints are intentionally **public and unauthenticated** so external
 * monitors (UptimeRobot) and lightweight status consumers can hit them freely.
 * `/status.json` is the primary keep-alive target that prevents the free host
 * from spinning down.
 */
import { Router } from 'express';
import type { LiveStateStore } from '../../bot/state.js';

export function createStatusRouter(state: LiveStateStore): Router {
  const router = Router();

  // Primary keep-alive target + lightweight public status API.
  router.get('/status.json', (_req, res) => {
    res.json(state.getStatusPayload());
  });

  // Liveness probe (process is up and serving).
  router.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  return router;
}
