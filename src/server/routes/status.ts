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
import type { BotStatus } from '../../bot/types.js';

/** Shields.io endpoint colors per bot status (masterdoc §18.11 status badge). */
const BADGE_COLOR: Record<BotStatus, string> = {
  connected: 'brightgreen',
  connecting: 'yellow',
  reconnecting: 'yellow',
  'hibernating-wait': 'yellow',
  disconnected: 'red',
  banned: 'red',
  fatal: 'red',
  'not-configured': 'lightgrey',
};

export function createStatusRouter(state: LiveStateStore): Router {
  const router = Router();

  // Primary keep-alive target + lightweight public status API.
  router.get('/status.json', (_req, res) => {
    res.json(state.getStatusPayload());
  });

  // Optional live-status badge (masterdoc §18.11). Serves the Shields.io
  // "endpoint" schema so anyone can embed a live badge for their deployment:
  //   https://img.shields.io/endpoint?url=https://<host>/badge.json
  router.get('/badge.json', (_req, res) => {
    const status = state.getStatusPayload().status;
    res.json({
      schemaVersion: 1,
      label: 'neobot',
      message: status,
      color: BADGE_COLOR[status] ?? 'lightgrey',
    });
  });

  // Liveness probe (process is up and serving).
  router.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  return router;
}
