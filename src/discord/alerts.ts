/**
 * Discord alert dispatcher (masterdoc §11).
 *
 * Fans connection/system alerts out to Discord, gated by the per-event
 * `alert_settings` toggles (default all-on). The send mechanism and the settings
 * source are injected, so this is testable without a live gateway. Everything is
 * best-effort — a Discord failure must never disturb the keep-alive daemon.
 */
import type { EmbedBuilder } from 'discord.js';
import { childLogger } from '../lib/logger.js';
import type { AlertEvent } from '../bot/types.js';
import type { AlertSetting, AlertSettingsRepository } from '../db/types.js';
import { formatAlertEmbed } from './presenters.js';

const log = childLogger('discord-alerts');

/** Pure gate: an event fires unless it's explicitly disabled (unknown = fire). */
export function shouldDispatch(key: string, settings: AlertSetting[]): boolean {
  const found = settings.find((s) => s.eventKey === key);
  return found ? found.enabled : true;
}

export type EmbedSender = (embed: EmbedBuilder) => Promise<void>;

export class DiscordAlerter {
  private cache: AlertSetting[] = [];
  private cachedAt = 0;

  constructor(
    private readonly send: EmbedSender,
    private readonly settings: AlertSettingsRepository,
    private readonly ttlMs = 10_000,
    private readonly now: () => number = Date.now,
  ) {}

  private async currentSettings(): Promise<AlertSetting[]> {
    if (this.now() - this.cachedAt > this.ttlMs) {
      try {
        this.cache = await this.settings.list();
        this.cachedAt = this.now();
      } catch (err) {
        log.warn({ err }, 'alert_settings.list failed — using last known toggles');
      }
    }
    return this.cache;
  }

  /** Post an alert embed if its event key is enabled. Never throws. */
  async dispatch(event: AlertEvent): Promise<void> {
    try {
      if (!shouldDispatch(event.key, await this.currentSettings())) return;
      await this.send(formatAlertEmbed(event));
    } catch (err) {
      log.warn({ err, key: event.key }, 'Failed to dispatch Discord alert');
    }
  }
}
