import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startSelfPing } from '../../src/watchdog/selfPing.js';

describe('startSelfPing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('pings on the interval (not immediately) and stops cleanly', () => {
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const handle = startSelfPing({ url: 'http://localhost/status.json', intervalMs: 1000, fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    handle.stop();
    vi.advanceTimersByTime(3000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('swallows fetch errors without throwing', () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('unreachable')));
    startSelfPing({ url: 'http://localhost/status.json', intervalMs: 1000, fetchImpl });
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
