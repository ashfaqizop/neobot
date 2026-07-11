import { describe, expect, it } from 'vitest';
import { classifyDisconnectReason } from '../src/bot/kickReasons.js';

describe('classifyDisconnectReason (masterdoc §6 table)', () => {
  it('AFK-kick → immediate retry, non-terminal', () => {
    const c = classifyDisconnectReason('You were kicked for being AFK too long');
    expect(c.category).toBe('afk');
    expect(c.retry).toBe('immediate');
    expect(c.terminal).toBe(false);
  });

  it('idle/inactivity phrasing also → afk', () => {
    expect(classifyDisconnectReason('Kicked due to inactivity').category).toBe('afk');
  });

  it('banned → terminal, no retry, alert', () => {
    const c = classifyDisconnectReason('You are banned from this server!');
    expect(c.category).toBe('banned');
    expect(c.terminal).toBe(true);
    expect(c.retry).toBe('none');
    expect(c.alert).toBe(true);
  });

  it('banned takes priority over anti-cheat keywords', () => {
    // "flying" would match anti-cheat, but a ban is terminal and must win.
    expect(classifyDisconnectReason('You are banned for flying').category).toBe('banned');
  });

  it('whitelist rejection → long retry, alert', () => {
    const c = classifyDisconnectReason('You are not whitelisted on this server');
    expect(c.category).toBe('whitelist');
    expect(c.retry).toBe('long');
    expect(c.alert).toBe(true);
    expect(c.terminal).toBe(false);
  });

  it('server restarting → backoff retry', () => {
    const c = classifyDisconnectReason('Server is restarting, please reconnect');
    expect(c.category).toBe('server_restart');
    expect(c.retry).toBe('backoff');
  });

  it('server full → backoff retry', () => {
    expect(classifyDisconnectReason('The server is full!').category).toBe('server_full');
  });

  it('anti-cheat (movement/flight) → backoff retry, alert', () => {
    const c = classifyDisconnectReason('Kicked by Grim: illegal movement (flight)');
    expect(c.category).toBe('anticheat');
    expect(c.alert).toBe(true);
    expect(c.retry).toBe('backoff');
  });

  it('network/socket errors → backoff retry', () => {
    expect(classifyDisconnectReason('socketClosed').category).toBe('network');
    expect(classifyDisconnectReason('read ECONNRESET').category).toBe('network');
    expect(classifyDisconnectReason('connect ETIMEDOUT 1.2.3.4:25565').category).toBe('network');
  });

  it('unrecognized reason → unknown, backoff retry (never throws)', () => {
    const c = classifyDisconnectReason('¯\\_(ツ)_/¯ mystery');
    expect(c.category).toBe('unknown');
    expect(c.retry).toBe('backoff');
    expect(c.terminal).toBe(false);
  });

  it('empty/nullish reason → unknown', () => {
    expect(classifyDisconnectReason('').category).toBe('unknown');
    expect(classifyDisconnectReason(null).category).toBe('unknown');
    expect(classifyDisconnectReason(undefined).category).toBe('unknown');
  });
});
