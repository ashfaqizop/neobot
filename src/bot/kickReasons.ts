/**
 * Disconnect / kick reason classification (masterdoc §6).
 *
 * Both `bot.on('kicked', reason)` (a chat object flattened via `.toString()`)
 * and `bot.on('end', reason)` (a plain string) funnel through
 * `classifyDisconnectReason`, which maps the raw text onto the §6 behavior
 * table. This is a pure function — the single most test-worthy unit in Phase 2.
 *
 * Rules are evaluated in priority order: the most consequential / specific
 * categories (banned, whitelist, anti-cheat) are checked before generic ones so
 * that, e.g., "you are banned for flying" classifies as `banned` (terminal), not
 * `anticheat`.
 */
import type { DisconnectCategory, DisconnectClassification } from './types.js';
import { HIBERNATION_PATTERNS } from './hibernation.js';

interface Rule {
  category: DisconnectCategory;
  patterns: RegExp[];
  classify: DisconnectClassification;
}

const rule = (
  category: DisconnectCategory,
  classify: Omit<DisconnectClassification, 'category'>,
  patterns: RegExp[],
): Rule => ({ category, patterns, classify: { category, ...classify } });

/** Ordered rules — first match wins. */
const RULES: Rule[] = [
  // Banned — terminal, alert immediately, never auto-retry.
  rule(
    'banned',
    { terminal: true, retry: 'none', alert: true },
    [/\bbanned\b/i, /\bban(?:ned)?\s+(?:from|for)\b/i, /black-?list/i, /you are banned/i],
  ),

  // Whitelist rejection — long back-off, alert once (don't spam).
  rule(
    'whitelist',
    { terminal: false, retry: 'long', alert: true },
    [/white-?list/i, /not\s+white-?listed/i],
  ),

  // Anti-cheat / movement flags — dial back (Safe Mode, Phase 9) then reconnect.
  rule(
    'anticheat',
    { terminal: false, retry: 'backoff', alert: true },
    [
      /anti-?cheat/i,
      /\bflying is not enabled\b/i,
      /\bflight\b/i,
      /\bflying\b/i,
      /illegal (?:movement|action)/i,
      /invalid move/i,
      /\bcheat(?:ing)?\b/i,
      /\bhack(?:ing|s)?\b/i,
      /\bvulcan\b/i,
      /\bgrim\b/i,
      /\bncp\b/i,
      /suspicious/i,
    ],
  ),

  // Hibernating / starting host (Aternos-style) — poll, don't count retries.
  // Checked before server_restart so "server is restarting/starting" wins here.
  rule('hibernating', { terminal: false, retry: 'poll', alert: true }, HIBERNATION_PATTERNS),

  // Server full — retry with back-off.
  rule(
    'server_full',
    { terminal: false, retry: 'backoff', alert: false },
    [/server is full/i, /\bfull\b/i],
  ),

  // Server restarting / shutting down — likely coming back, back-off retry.
  rule(
    'server_restart',
    { terminal: false, retry: 'backoff', alert: false },
    [/restart/i, /shutting down/i, /server clos/i, /going down/i, /reboot/i],
  ),

  // AFK / idle kick — reconnect immediately, nudge activity up.
  rule(
    'afk',
    { terminal: false, retry: 'immediate', alert: false },
    [/\bafk\b/i, /away from keyboard/i, /idle/i, /inactiv/i],
  ),

  // Network / socket level — back-off retry.
  rule(
    'network',
    { terminal: false, retry: 'backoff', alert: false },
    [
      /socketclosed/i,
      /econnreset/i,
      /econnrefused/i,
      /etimedout/i,
      /enotfound/i,
      /ehostunreach/i,
      /enetunreach/i,
      /epipe/i,
      /timed? ?out/i,
      /connection reset/i,
      /keepalive/i,
      /read econn/i,
    ],
  ),
];

/** Fallback for anything we don't recognize: log raw, generic back-off retry. */
const UNKNOWN: DisconnectClassification = {
  category: 'unknown',
  terminal: false,
  retry: 'backoff',
  alert: false,
};

/**
 * Classify a raw disconnect/kick reason string into a behavior decision.
 * Never throws; unmatched input falls back to `unknown` (back-off retry).
 */
export function classifyDisconnectReason(reason: string | null | undefined): DisconnectClassification {
  const text = (reason ?? '').toString();
  if (text.trim().length === 0) return UNKNOWN;

  for (const r of RULES) {
    if (r.patterns.some((p) => p.test(text))) return r.classify;
  }
  return UNKNOWN;
}
