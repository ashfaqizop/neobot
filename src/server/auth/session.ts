/**
 * Session tokens (masterdoc §8.2).
 *
 * A minimal signed-cookie session using `node:crypto` HMAC — no external JWT
 * dependency. The token is `base64url(payloadJson).base64url(hmac)`; verifying
 * recomputes the HMAC (constant-time compare) and checks the expiry.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import { env } from '../../config/env.js';
import { childLogger } from '../../lib/logger.js';

const log = childLogger('auth');

export const SESSION_COOKIE = 'neobot_session';
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Resolve the signing secret once (auto-generate + warn if unset). */
const secret: string = (() => {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  log.warn('SESSION_SECRET not set — generating a random one (sessions reset on restart).');
  return randomBytes(32).toString('hex');
})();

interface SessionPayload {
  sub: string; // admin username
  exp: number; // epoch ms
}

const b64url = (buf: Buffer): string => buf.toString('base64url');

function hmac(data: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

/** Create a signed session token for a username. */
export function signSession(username: string, ttlMs: number = DEFAULT_TTL_MS, now: number = Date.now()): string {
  const payload: SessionPayload = { sub: username, exp: now + ttlMs };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(hmac(body));
  return `${body}.${sig}`;
}

/** Verify a token; returns the username or null if invalid/expired. */
export function verifySession(token: string | undefined, now: number = Date.now()): string | null {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = b64url(hmac(body));
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp < now) return null;
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/** Parse a Cookie header into a map (no cookie-parser dependency). */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: DEFAULT_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}
