import { describe, expect, it, vi } from 'vitest';
import { BotController } from '../../src/bot/controller.js';
import { LiveStateStore } from '../../src/bot/state.js';

function make() {
  const connection = { restart: vi.fn(), reconnectNow: vi.fn() };
  const engine = { setManualPause: vi.fn(), isManuallyPaused: vi.fn(() => false), setSafeMode: vi.fn() };
  const state = new LiveStateStore();
  const controller = new BotController(connection, engine, state);
  return { controller, connection, engine };
}

describe('BotController', () => {
  it('pause/resume drive the engine', () => {
    const { controller, engine } = make();
    controller.pause();
    expect(engine.setManualPause).toHaveBeenCalledWith(true);
    controller.resume();
    expect(engine.setManualPause).toHaveBeenCalledWith(false);
  });

  it('restart/reconnect drive the connection', () => {
    const { controller, connection } = make();
    controller.restart();
    expect(connection.restart).toHaveBeenCalledOnce();
    controller.reconnect();
    expect(connection.reconnectNow).toHaveBeenCalledOnce();
  });

  it('tracks safe-mode state', () => {
    const { controller } = make();
    expect(controller.isSafeMode()).toBe(false);
    controller.setSafeMode(true);
    expect(controller.isSafeMode()).toBe(true);
  });

  it('snapshot includes resource usage and flags', () => {
    const { controller } = make();
    const snap = controller.snapshot();
    expect(snap.resource.rssBytes).toBeGreaterThan(0);
    expect(snap).toHaveProperty('paused');
    expect(snap).toHaveProperty('safeMode');
    expect(snap).toHaveProperty('status');
  });
});
