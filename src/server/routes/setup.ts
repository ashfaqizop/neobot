/**
 * Setup-wizard routes (masterdoc §8.3). Public — used before an admin exists.
 */
import { Router } from 'express';
import type { ApiDeps } from '../deps.js';
import { runSetup, setupSchema, setupStatus, SetupError } from '../setupWizard.js';
import { asyncHandler } from './asyncHandler.js';

export function createSetupRouter(deps: ApiDeps): Router {
  const router = Router();

  router.get(
    '/status',
    asyncHandler(async (_req, res) => {
      res.json(await setupStatus(deps.repos));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = setupSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_payload', details: parsed.error.issues });
        return;
      }
      try {
        const config = await runSetup(parsed.data, deps.repos);
        deps.config.set(config);
        res.status(201).json({ ok: true });
      } catch (err) {
        if (err instanceof SetupError) {
          res.status(409).json({ error: 'already_configured' });
          return;
        }
        throw err;
      }
    }),
  );

  return router;
}
