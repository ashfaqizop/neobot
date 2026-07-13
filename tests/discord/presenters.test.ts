import { describe, expect, it } from 'vitest';
import {
  buildConfigSummary,
  buildLogsContent,
  buildStatusEmbed,
  formatAlertEmbed,
  humanizeAlertKey,
} from '../../src/discord/presenters.js';
import { buildDefaultAppConfig } from '../../src/config/appConfig.js';
import { env } from '../../src/config/env.js';
import type { ControllerSnapshot } from '../../src/bot/controller.js';
import type { EventRecord } from '../../src/db/types.js';

function snapshot(overrides: Partial<ControllerSnapshot> = {}): ControllerSnapshot {
  const now = new Date().toISOString();
  return {
    status: 'connected',
    currentActivity: 'walk',
    lastDisconnectReason: null,
    uptimePercent: 99.5,
    sessions: [{ connectedAt: now, disconnectedAt: null, disconnectReason: null }],
    reconnectHistory: [],
    position: { x: 10, y: 64, z: -20 },
    playerCount: 2,
    startedAt: now,
    lastUpdated: now,
    resource: { rssBytes: 120 * 1024 * 1024, heapUsedBytes: 60 * 1024 * 1024 },
    paused: false,
    safeMode: false,
    ...overrides,
  };
}

describe('humanizeAlertKey', () => {
  it('maps known keys and titleizes unknown ones', () => {
    expect(humanizeAlertKey('reconnect_failed')).toBe('Reconnect failed');
    expect(humanizeAlertKey('banned')).toBe('Banned');
    expect(humanizeAlertKey('foo_bar')).toBe('Foo Bar');
  });
});

describe('buildStatusEmbed', () => {
  it('summarizes connection, activity, memory, and flags', () => {
    const embed = buildStatusEmbed(snapshot({ paused: true }));
    const fields = embed.data.fields ?? [];
    const byName = Object.fromEntries(fields.map((f) => [f.name, f.value]));
    expect(embed.data.title).toBe('NeoBot status');
    expect(byName['Connection']).toBe('connected');
    expect(byName['Activity']).toBe('walk');
    expect(byName['Players nearby']).toBe('2');
    expect(byName['Memory']).toBe('120 MB');
    expect(byName['Paused']).toBe('yes');
  });
});

describe('buildConfigSummary', () => {
  it('renders the non-secret config summary', () => {
    const config = buildDefaultAppConfig(env);
    const embed = buildConfigSummary(config);
    expect(embed.data.title).toBe('NeoBot configuration');
    const names = (embed.data.fields ?? []).map((f) => f.name);
    expect(names).toContain('Server');
    expect(names.some((n) => n.startsWith('Behaviors'))).toBe(true);
  });
});

describe('buildLogsContent', () => {
  const events: EventRecord[] = [
    { id: 1, createdAt: '2026-07-13T10:00:00.000Z', level: 'info', category: 'connection', message: 'a' },
    { id: 2, createdAt: '2026-07-13T10:01:00.000Z', level: 'warn', category: 'behavior', message: 'b' },
    { id: 3, createdAt: '2026-07-13T10:02:00.000Z', level: 'error', category: 'discord', message: 'c' },
  ];

  it('renders a code block, respecting the line limit', () => {
    const out = buildLogsContent(events, 2);
    expect(out).toContain('```');
    expect(out).toContain('a');
    expect(out).toContain('b');
    expect(out).not.toContain('] (discord) c');
  });

  it('handles the empty state', () => {
    expect(buildLogsContent([], 10)).toBe('No events recorded yet.');
  });
});

describe('formatAlertEmbed', () => {
  it('colors by severity and carries the message', () => {
    const banned = formatAlertEmbed({ key: 'banned', message: 'You are banned' });
    expect(banned.data.title).toContain('Banned');
    expect(banned.data.description).toBe('You are banned');
    expect(banned.data.color).toBe(0xf87171);

    const connected = formatAlertEmbed({ key: 'connected', message: 'up' });
    expect(connected.data.color).toBe(0x34d399);
  });
});
