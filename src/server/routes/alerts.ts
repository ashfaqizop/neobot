/**
 * Alert-settings routes (masterdoc §11). Protected. Backs the dashboard Alerts
 * panel and mirrors the Discord `/alerts` command — the same per-event toggles
 * in `alert_settings`, default all-on.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { ApiDeps } from '../deps.js';
import { asyncHandler } from './asyncHandler.js';

const toggleSchema = z.object({ eventKey: z.string().min(1), enabled: z.boolean() });

export function createAlertsRouter(deps: ApiDeps): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json(await deps.repos.alertSettings.list());
    }),
  );

  router.put(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = toggleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_payload' });
        return;
      }
      await deps.repos.alertSettings.setEnabled(parsed.data.eventKey, parsed.data.enabled);
      res.json({ ok: true });
    }),
  );

  return router;
}
