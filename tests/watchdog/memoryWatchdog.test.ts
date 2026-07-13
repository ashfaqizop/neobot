import { describe, expect, it, vi } from 'vitest';
import { MemoryWatchdog } from '../../src/watchdog/memoryWatchdog.js';

const MB = 1024 * 1024;

function harness(threshold = 400 * MB, graceMs = 5000) {
  let rss = 100 * MB;
  let clock = 0;
  const restartConnection = vi.fn();
  const restartProcess = vi.fn();
  const onAlert = vi.fn();
  const wd = new MemoryWatchdog({
    thresholdBytes: threshold,
    checkIntervalMs: 1000,
    graceMs,
    restartConnection,
    restartProcess,
    onAlert,
    readMemory: () => rss,
    now: () => clock,
  });
  return {
    wd,
    restartConnection,
    restartProcess,
    onAlert,
    setRss: (v: number) => (rss = v),
    setClock: (v: number) => (clock = v),
  };
}

describe('MemoryWatchdog', () => {
  it('stays quiet below the threshold', () => {
    const h = harness();
    h.wd.check();
    h.wd.check();
    expect(h.restartConnection).not.toHaveBeenCalled();
    expect(h.restartProcess).not.toHaveBeenCalled();
  });

  it('tier 1: restarts the connection + alerts when RSS crosses the threshold', () => {
    const h = harness();
    h.setRss(500 * MB);
    h.wd.check();
    expect(h.restartConnection).toHaveBeenCalledOnce();
    expect(h.onAlert).toHaveBeenCalledWith(expect.objectContaining({ key: 'low_memory' }));
    expect(h.restartProcess).not.toHaveBeenCalled();
  });

  it('recovers without escalating if memory drops during the grace period', () => {
    const h = harness();
    h.setRss(500 * MB);
    h.wd.check(); // tier 1 → grace
    h.setRss(120 * MB); // recovered
    h.setClock(10_000); // past grace
    h.wd.check();
    expect(h.restartProcess).not.toHaveBeenCalled();
  });

  it('tier 2: restarts the process if still over after the grace period', () => {
    const h = harness();
    h.setRss(500 * MB);
    h.wd.check(); // tier 1 → grace (graceStart = 0)
    h.setClock(2000); // within grace
    h.wd.check();
    expect(h.restartProcess).not.toHaveBeenCalled();
    h.setClock(6000); // past grace, still over
    h.wd.check();
    expect(h.restartProcess).toHaveBeenCalledOnce();
  });
});
