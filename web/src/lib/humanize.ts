/**
 * Render-boundary humanizers (critique P2). The backend speaks in enums and
 * camelCase identifiers (`server_restart`, `jumpLook`, `invalid_config`); the
 * operator shouldn't have to. These map raw values to plain language right where
 * they're displayed, leaving the wire format untouched.
 */
import type { DisconnectCategory } from './types.ts';

const CATEGORY_LABELS: Record<DisconnectCategory, string> = {
  afk: 'AFK kick',
  banned: 'Banned',
  whitelist: 'Whitelist',
  server_restart: 'Server restart',
  server_full: 'Server full',
  anticheat: 'Anti-cheat',
  network: 'Network',
  unknown: 'Unknown',
};

export function humanizeCategory(category: string): string {
  return CATEGORY_LABELS[category as DisconnectCategory] ?? titleize(category);
}

/** Friendly labels for the behavior identifiers surfaced as `currentActivity`. */
const BEHAVIOR_LABELS: Record<string, string> = {
  walk: 'Walking',
  jumpLook: 'Jump & look',
  pathfindRandom: 'Pathfinding',
  chat: 'Chatting',
  sneak: 'Sneaking',
  swim: 'Swimming',
  eat: 'Eating',
  fish: 'Fishing',
  sleep: 'Sleeping',
  doors: 'Using doors',
  boat: 'Boating',
  lookAtEntity: 'Looking around',
  itemDropPickup: 'Sorting items',
  mineBlocks: 'Mining',
  idle: 'Idle',
};

/**
 * Humanize `currentActivity`. Handles bare behavior names, `paused: <reason>`,
 * and `hazard: <type>` — capitalizing and de-jargoning while staying faithful.
 */
export function humanizeActivity(activity: string | null): string {
  if (!activity) return 'Idle';
  const colon = activity.indexOf(':');
  if (colon !== -1) {
    const prefix = activity.slice(0, colon).trim();
    const rest = activity.slice(colon + 1).trim();
    if (prefix === 'paused') return `Paused — ${rest === 'manual' ? 'by you' : rest}`;
    if (prefix === 'hazard') return `Avoiding hazard — ${rest}`;
    return `${titleize(prefix)} — ${rest}`;
  }
  return BEHAVIOR_LABELS[activity] ?? titleize(activity);
}

/** Map known API error codes to sentences; pass through anything already prose. */
const ERROR_MESSAGES: Record<string, string> = {
  invalid_config: 'That configuration is invalid — please review the fields.',
  invalid_payload: 'Some fields are invalid — please review and try again.',
  already_configured: 'This instance is already configured.',
  invalid_credentials: 'Incorrect username or password.',
  unauthorized: 'Your session expired — please sign in again.',
  forbidden: 'Access denied from this location.',
  internal_error: 'Something went wrong on the server. Please try again.',
};

export function humanizeError(message: string): string {
  return ERROR_MESSAGES[message] ?? message;
}

/** `server_restart` / `jumpLook` → `Server restart` / `Jump look`. */
function titleize(raw: string): string {
  const spaced = raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
