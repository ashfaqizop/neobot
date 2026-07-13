import { describe, expect, it, vi } from 'vitest';
import {
  handleInteraction,
  type CommandContext,
  type SlashInteraction,
} from '../../src/discord/commands.js';
import type { BotController, ControllerSnapshot } from '../../src/bot/controller.js';
import { buildDefaultAppConfig } from '../../src/config/appConfig.js';
import { env } from '../../src/config/env.js';
import type { EventsRepository, AlertSettingsRepository } from '../../src/db/types.js';

function snapshot(): ControllerSnapshot {
  const now = new Date().toISOString();
  return {
    status: 'connected',
    currentActivity: 'idle',
    lastDisconnectReason: null,
    uptimePercent: 100,
    sessions: [],
    reconnectHistory: [],
    position: null,
    playerCount: 0,
    startedAt: now,
    lastUpdated: now,
    resource: { rssBytes: 1024 * 1024, heapUsedBytes: 1024 },
    paused: false,
    safeMode: false,
  };
}

function fakeController() {
  return {
    pause: vi.fn(),
    resume: vi.fn(),
    restart: vi.fn(),
    reconnect: vi.fn(),
    setSafeMode: vi.fn(),
    isSafeMode: vi.fn(() => false),
    snapshot: vi.fn(snapshot),
  };
}

function makeCtx() {
  const controller = fakeController();
  const events: EventsRepository = {
    append: vi.fn(() => Promise.resolve()),
    recent: vi.fn(() => Promise.resolve([])),
  };
  const alertSettings: AlertSettingsRepository = {
    list: vi.fn(() => Promise.resolve([{ eventKey: 'connected', enabled: true }])),
    setEnabled: vi.fn(() => Promise.resolve()),
    ensureDefaults: vi.fn(() => Promise.resolve()),
  };
  const ctx: CommandContext = {
    controller: controller as unknown as BotController,
    getConfig: () => buildDefaultAppConfig(env),
    events,
    alertSettings,
  };
  return { ctx, controller, events, alertSettings };
}

function interaction(
  commandName: string,
  opts: { strings?: Record<string, string>; integers?: Record<string, number>; subcommand?: string } = {},
): SlashInteraction & { reply: ReturnType<typeof vi.fn> } {
  return {
    commandName,
    options: {
      getString: (n: string) => opts.strings?.[n] ?? null,
      getInteger: (n: string) => opts.integers?.[n] ?? null,
      getSubcommand: () => opts.subcommand ?? '',
    },
    reply: vi.fn(() => Promise.resolve()),
  };
}

describe('handleInteraction', () => {
  it('/pause drives the controller and replies', async () => {
    const { ctx, controller } = makeCtx();
    const i = interaction('pause');
    await handleInteraction(i, ctx);
    expect(controller.pause).toHaveBeenCalledOnce();
    expect(i.reply).toHaveBeenCalledOnce();
  });

  it('/safe-mode on enables Safe Mode', async () => {
    const { ctx, controller } = makeCtx();
    await handleInteraction(interaction('safe-mode', { strings: { state: 'on' } }), ctx);
    expect(controller.setSafeMode).toHaveBeenCalledWith(true);
  });

  it('/status replies with an embed built from the snapshot', async () => {
    const { ctx, controller } = makeCtx();
    const i = interaction('status');
    await handleInteraction(i, ctx);
    expect(controller.snapshot).toHaveBeenCalled();
    expect(i.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
  });

  it('/logs passes the requested line count to the repository', async () => {
    const { ctx, events } = makeCtx();
    await handleInteraction(interaction('logs', { integers: { lines: 5 } }), ctx);
    expect(events.recent).toHaveBeenCalledWith(5);
  });

  it('/alerts mute toggles the setting off', async () => {
    const { ctx, alertSettings } = makeCtx();
    await handleInteraction(
      interaction('alerts', { subcommand: 'mute', strings: { event: 'connected' } }),
      ctx,
    );
    expect(alertSettings.setEnabled).toHaveBeenCalledWith('connected', false);
  });

  it('/alerts view lists toggles without mutating', async () => {
    const { ctx, alertSettings } = makeCtx();
    await handleInteraction(interaction('alerts', { subcommand: 'view' }), ctx);
    expect(alertSettings.list).toHaveBeenCalled();
    expect(alertSettings.setEnabled).not.toHaveBeenCalled();
  });
});
