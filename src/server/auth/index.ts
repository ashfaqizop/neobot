/**
 * Composed authorization (masterdoc §8.2).
 *
 * The three layers combine as:
 *   authorized = (valid session OR valid access token)
 *                AND (ipAllowlist disabled OR client ip in list)
 *
 * A solo user runs on just login+password (the other two layers off by default).
 * The same `authorizeRequest` logic backs both the Express middleware and the
 * Socket.IO handshake, so they can never drift.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AppConfig } from '../../config/appConfig.js';
import { isIpAllowed } from './ipAllowlist.js';
import { parseCookies, SESSION_COOKIE, verifySession } from './session.js';
import { isValidAccessToken } from './token.js';

export type ConfigProvider = () => AppConfig;

export interface AuthResult {
  ok: boolean;
  status: number; // 200 | 401 | 403
  username?: string;
}

interface AuthInput {
  ip: string | undefined;
  cookieHeader: string | undefined;
  token: string | undefined;
}

/** Core, transport-agnostic authorization decision. */
export function authorize(input: AuthInput, config: AppConfig): AuthResult {
  // IP allowlist gate (applied on top of everything else).
  if (config.auth.ipAllowlist.enabled && !isIpAllowed(input.ip, config.auth.ipAllowlist.entries)) {
    return { ok: false, status: 403 };
  }

  // Valid login session?
  const cookies = parseCookies(input.cookieHeader);
  const username = verifySession(cookies[SESSION_COOKIE]);
  if (username) return { ok: true, status: 200, username };

  // ...or a valid shareable access token (when that layer is enabled)?
  if (config.auth.tokenUrl.enabled && isValidAccessToken(input.token, config.auth.tokenUrl.token)) {
    return { ok: true, status: 200 };
  }

  return { ok: false, status: 401 };
}

/** Extract the auth inputs from an Express request. */
export function authorizeRequest(req: Request, config: AppConfig): AuthResult {
  const headerToken = req.header('x-access-token');
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  return authorize(
    { ip: req.ip, cookieHeader: req.headers.cookie, token: headerToken ?? queryToken },
    config,
  );
}

/** Express middleware guarding protected routes. */
export function requireAuth(getConfig: ConfigProvider): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = authorizeRequest(req, getConfig());
    if (result.ok) {
      next();
      return;
    }
    res.status(result.status).json({ error: result.status === 403 ? 'forbidden' : 'unauthorized' });
  };
}

export * from './session.js';
export * from './password.js';
export * from './ipAllowlist.js';
export * from './token.js';
