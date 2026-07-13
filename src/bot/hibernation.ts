/**
 * Aternos-style hibernating-host detection (masterdoc §6, §12).
 *
 * Free hosts (Aternos and similar) put a server to sleep after inactivity and
 * show a "starting / in queue / offline" state when you try to join — which is
 * NOT a real failure. Detecting it lets the connection manager poll-reconnect on
 * a steady interval (status `hibernating-wait`) until the server is actually up,
 * rather than burning through the max-retry budget.
 *
 * There is no standard protocol message for this, so detection is heuristic: a
 * shared, tested list of reason patterns reused by the kick classifier.
 */

/** Reason substrings/patterns that indicate the host is asleep or starting. */
export const HIBERNATION_PATTERNS: RegExp[] = [
  // "starting" (not "restarting" — a reboot is a normal server_restart/backoff).
  /server is starting/i,
  /still (?:starting|loading|booting)/i,
  /\bstarting up\b/i,
  /position in queue/i,
  /\bin queue\b/i,
  /waiting in queue/i,
  /server (?:is )?offline/i,
  /server (?:not|isn'?t) (?:started|online|running)/i,
  /\bhibernat/i,
];

/** True when a disconnect/kick reason looks like a hibernating/starting host. */
export function isHibernating(reason: string | null | undefined): boolean {
  const text = (reason ?? '').toString();
  if (text.trim().length === 0) return false;
  return HIBERNATION_PATTERNS.some((p) => p.test(text));
}
