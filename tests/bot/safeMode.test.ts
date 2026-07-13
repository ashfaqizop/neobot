import { describe, expect, it, vi } from 'vitest';
import { SafeModeManager } from '../../src/bot/safeMode.js';

describe('SafeModeManager', () => {
  it('auto-enables Safe Mode after the threshold of anti-cheat kicks in the window', () => {
    const setSafeMode = vi.fn();
    const onAlert = vi.fn();
    const clock = 0;
    const mgr = new SafeModeManager({
      threshold: 3,
      windowMs: 1000,
      autoDetect: true,
      setSafeMode,
      onAlert,
      now: () => clock,
    });

    mgr.recordAntiCheat();
    mgr.recordAntiCheat();
    expect(setSafeMode).not.toHaveBeenCalled();
    mgr.recordAntiCheat();
    expect(setSafeMode).toHaveBeenCalledWith(true);
    expect(onAlert).toHaveBeenCalledWith(expect.objectContaining({ key: 'safe_mode' }));
  });

  it('does not trip when events are spread beyond the window', () => {
    const setSafeMode = vi.fn();
    let clock = 0;
    const mgr = new SafeModeManager({ threshold: 3, windowMs: 1000, autoDetect: true, setSafeMode, now: () => clock });

    mgr.recordAntiCheat(); // t=0
    clock = 2000;
    mgr.recordAntiCheat(); // old one pruned
    clock = 2001;
    mgr.recordAntiCheat();
    expect(setSafeMode).not.toHaveBeenCalled();
  });

  it('is a no-op when auto-detection is disabled', () => {
    const setSafeMode = vi.fn();
    const mgr = new SafeModeManager({ threshold: 1, windowMs: 1000, autoDetect: false, setSafeMode });
    mgr.recordAntiCheat();
    expect(setSafeMode).not.toHaveBeenCalled();
  });
});
