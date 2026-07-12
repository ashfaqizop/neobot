/**
 * Token-URL access (masterdoc §8.2) — the optional shareable-link layer.
 *
 * When enabled, a request carrying the configured access token (via `?token=`
 * or the `x-access-token` header) is authorized without a login session.
 */
import { timingSafeEqual } from 'node:crypto';
import { randomBytes } from 'node:crypto';

/** Generate a new URL-safe access token. */
export function generateAccessToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Constant-time compare of a provided token against the configured one. */
export function isValidAccessToken(provided: string | undefined, expected: string | null): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
