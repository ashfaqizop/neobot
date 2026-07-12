/**
 * Config routes (masterdoc §8.5). Protected. Get/update the live config and
 * export/import it as JSON (useful before a redeploy wipes ephemeral disk).
 *
 * The stored config contains no secrets, so it is safe to return/export as-is.
 * Behavior/connection changes persist immediately; some take full effect on the
 * next connection restart (`POST /api/control/restart`).
 */
import { Router } from 'express';
import type { ApiDeps } from '../deps.js';
import { appConfigSchema } from '../../config/appConfigSchema.js';
import type { AppConfig } from '../../config/appConfig.js';
import { asyncHandler } from './asyncHandler.js';

async function applyConfig(deps: ApiDeps, config: AppConfig): Promise<void> {
  await deps.repos.config.save(config);
  deps.config.set(config);
}

export function createConfigRouter(deps: ApiDeps): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(deps.config.get());
  });

  router.put(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = appConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_config', details: parsed.error.issues });
        return;
      }
      await applyConfig(deps, parsed.data);
      res.json({ ok: true });
    }),
  );

  router.get('/export', (_req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="neobot-config.json"');
    res.json(deps.config.get());
  });

  router.post(
    '/import',
    asyncHandler(async (req, res) => {
      const parsed = appConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_config', details: parsed.error.issues });
        return;
      }
      await applyConfig(deps, parsed.data);
      res.json({ ok: true });
    }),
  );

  return router;
}
