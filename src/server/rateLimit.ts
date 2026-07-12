/**
 * Rate limiting + lockout (masterdoc §8.2, §13).
 *
 * A strict limiter on the login endpoint (brute-force lockout) and a general
 * limiter across the API. Relies on `app.set('trust proxy', 1)` for correct
 * client IPs behind the platform proxy.
 */
import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';

const FIFTEEN_MIN = 15 * 60 * 1000;

/** Strict: a handful of login attempts per window, then 429 lockout. */
export function createLoginLimiter(limit = 5): RateLimitRequestHandler {
  return rateLimit({
    windowMs: FIFTEEN_MIN,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'too_many_login_attempts' },
  });
}

/** General API limiter. */
export function createApiLimiter(limit = 300): RateLimitRequestHandler {
  return rateLimit({
    windowMs: FIFTEEN_MIN,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'too_many_requests' },
  });
}
