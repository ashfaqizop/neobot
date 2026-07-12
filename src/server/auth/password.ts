/**
 * Admin password hashing (masterdoc §13 — bcrypt).
 *
 * Uses `bcryptjs` (pure JS, no native build — friendly to free-tier hosts).
 * bcryptjs is CommonJS, so it's imported as a default and used via its methods.
 */
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
