/**
 * Pure formatting helpers. Timestamps localize to the viewer's browser timezone
 * (raw values are UTC ISO strings, per masterdoc §8.1). Kept side-effect-free so
 * they're trivially unit-testable.
 */
import type { BotStatus } from './types.ts';

export type StatusTone = 'ok' | 'warn' | 'idle' | 'danger' | 'accent';

/** Map a BotStatus to a semantic tone (color role) + human label. */
export function statusMeta(status: BotStatus): { tone: StatusTone; label: string } {
  switch (status) {
    case 'connected':
      return { tone: 'ok', label: 'Connected' };
    case 'connecting':
      return { tone: 'warn', label: 'Connecting' };
    case 'reconnecting':
      return { tone: 'warn', label: 'Reconnecting' };
    case 'hibernating-wait':
      return { tone: 'warn', label: 'Hibernating (waiting)' };
    case 'disconnected':
      return { tone: 'idle', label: 'Disconnected' };
    case 'banned':
      return { tone: 'danger', label: 'Banned' };
    case 'fatal':
      return { tone: 'danger', label: 'Fatal' };
    case 'not-configured':
    default:
      return { tone: 'idle', label: 'Not configured' };
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

/** Localized absolute timestamp, e.g. "Jul 13, 14:22:07". */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Compact relative time, e.g. "just now", "3m ago", "2h ago". */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const secs = Math.round((now - t) / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Duration since an ISO instant as "3d 04h 12m" / "12m 05s". */
export function formatDuration(fromIso: string, now: number = Date.now()): string {
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return '—';
  let secs = Math.max(0, Math.floor((now - from) / 1000));
  const days = Math.floor(secs / 86400);
  secs -= days * 86400;
  const hours = Math.floor(secs / 3600);
  secs -= hours * 3600;
  const mins = Math.floor(secs / 60);
  secs -= mins * 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(mins)}m`;
  if (hours > 0) return `${hours}h ${pad(mins)}m`;
  return `${mins}m ${pad(secs)}s`;
}

export function formatCoord(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
