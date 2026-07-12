/**
 * Control routes (masterdoc §11). Protected. Drive the shared BotController.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { ApiDeps } from '../deps.js';

const safeModeSchema = z.object({ enabled: z.boolean() });

export function createControlRouter(deps: ApiDeps): Router {
  const router = Router();

  router.post('/pause', (_req, res) => {
    deps.controller.pause();
    res.json({ ok: true, paused: true });
  });

  router.post('/resume', (_req, res) => {
    deps.controller.resume();
    res.json({ ok: true, paused: false });
  });

  router.post('/restart', (_req, res) => {
    deps.controller.restart();
    res.json({ ok: true });
  });

  router.post('/reconnect', (_req, res) => {
    deps.controller.reconnect();
    res.json({ ok: true });
  });

  router.post('/safe-mode', (req, res) => {
    const parsed = safeModeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_payload' });
      return;
    }
    deps.controller.setSafeMode(parsed.data.enabled);
    res.json({ ok: true, safeMode: deps.controller.isSafeMode() });
  });

  return router;
}
