/**
 * Self-ping keep-alive fallback (masterdoc §10).
 *
 * UptimeRobot is the primary keep-alive; this optional internal self-ping is a
 * **default-OFF** fallback that GETs the app's own `/status.json` on an interval.
 *
 * Important limitation: a self-ping cannot revive an already-slept host (the
 * request originates from the sleeping process), so it only guards against
 * in-game AFK-kicks, not host hibernation. Best-effort — errors are logged, never
 * thrown.
 */
import { childLogger } from '../lib/logger.js';

const log = childLogger('self-ping');

export interface SelfPingOptions {
  url: string;
  intervalMs: number;
  /** Injectable fetch for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

export interface SelfPingHandle {
  stop: () => void;
}

export function startSelfPing(opts: SelfPingOptions): SelfPingHandle {
  const doFetch = opts.fetchImpl ?? fetch;
  log.info({ url: opts.url, intervalMs: opts.intervalMs }, 'Self-ping enabled (AFK-only fallback)');

  const ping = (): void => {
    void doFetch(opts.url, { method: 'GET' })
      .then((res) => {
        if (!res.ok) log.warn({ status: res.status }, 'Self-ping non-OK response');
      })
      .catch((err: unknown) => log.warn({ err }, 'Self-ping failed'));
  };

  const timer = setInterval(ping, opts.intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return { stop: () => clearInterval(timer) };
}
