/**
 * Auth routes (masterdoc §8.2): login/logout/me.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { ApiDeps } from '../deps.js';
import {
  clearSessionCookie,
  parseCookies,
  SESSION_COOKIE,
  setSessionCookie,
  signSession,
  verifyPassword,
  verifySession,
} from '../auth/index.js';
import { asyncHandler } from './asyncHandler.js';

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

export function createAuthRouter(deps: ApiDeps): Router {
  const router = Router();

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid_payload' });
        return;
      }
      const user = await deps.repos.adminUsers.findByUsername(parsed.data.username);
      const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
      if (!user || !ok) {
        res.status(401).json({ error: 'invalid_credentials' });
        return;
      }
      setSessionCookie(res, signSession(user.username));
      res.json({ ok: true, username: user.username });
    }),
  );

  router.post('/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    const username = verifySession(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
    if (username) {
      res.json({ username });
    } else {
      res.status(401).json({ error: 'unauthorized' });
    }
  });

  return router;
}
