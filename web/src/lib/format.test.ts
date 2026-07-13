import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, statusMeta } from './format.ts';

describe('statusMeta', () => {
  it('maps BotStatus to semantic tone + label', () => {
    expect(statusMeta('connected')).toEqual({ tone: 'ok', label: 'Connected' });
    expect(statusMeta('reconnecting').tone).toBe('warn');
    expect(statusMeta('banned').tone).toBe('danger');
    expect(statusMeta('not-configured')).toEqual({ tone: 'idle', label: 'Not configured' });
  });
});

describe('formatBytes', () => {
  it('formats MB and GB', () => {
    expect(formatBytes(0)).toBe('0 MB');
    expect(formatBytes(52 * 1024 * 1024)).toBe('52.0 MB');
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB');
  });
});

describe('formatDuration', () => {
  it('renders d/h/m and m/s tiers', () => {
    const base = Date.parse('2026-07-13T00:00:00Z');
    expect(formatDuration('2026-07-13T00:00:00Z', base + 125_000)).toBe('2m 05s');
    expect(formatDuration('2026-07-13T00:00:00Z', base + 3_700_000)).toBe('1h 01m');
    expect(formatDuration('2026-07-13T00:00:00Z', base + 90_000_000)).toMatch(/^1d /);
  });
});
