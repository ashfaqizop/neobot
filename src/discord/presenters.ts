/**
 * Discord message presenters (masterdoc §11).
 *
 * Pure builders that turn NeoBot state into Discord embeds / content. Kept free
 * of any live client or gateway so they're trivially unit-testable — the command
 * handlers and the alert dispatcher call these, then send the result.
 */
import { EmbedBuilder } from 'discord.js';
import type { ControllerSnapshot } from '../bot/controller.js';
import type { AppConfig } from '../config/appConfig.js';
import type { EventRecord } from '../db/types.js';
import type { AlertEvent, BotStatus } from '../bot/types.js';

const BRAND = 0x4fd8ff;
const OK = 0x34d399;
const WARN = 0xfbbf24;
const DANGER = 0xf87171;
const IDLE = 0x94a3b8;

/** Friendly labels for the alert_settings event keys (masterdoc §11). */
export const ALERT_LABELS: Record<string, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  reconnect_failed: 'Reconnect failed',
  kicked: 'Kicked',
  banned: 'Banned',
  anticheat: 'Anti-cheat kick',
  whitelist: 'Whitelist rejection',
  crash: 'Crash / error',
  low_memory: 'Low memory',
  safe_mode: 'Safe Mode',
  hibernating: 'Host hibernating',
};

/** The canonical alert event keys (seeded into `alert_settings`, §11). */
export const ALERT_KEYS = Object.keys(ALERT_LABELS);

export function humanizeAlertKey(key: string): string {
  return (
    ALERT_LABELS[key] ??
    key
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

const STATUS_COLOR: Record<BotStatus, number> = {
  connected: OK,
  connecting: WARN,
  reconnecting: WARN,
  'hibernating-wait': WARN,
  disconnected: IDLE,
  banned: DANGER,
  fatal: DANGER,
  'not-configured': IDLE,
};

const mb = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
/** Discord relative-time token, e.g. "3 minutes ago". */
const rel = (iso: string): string => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '—' : `<t:${Math.floor(t / 1000)}:R>`;
};

/** `/status` — connection/activity/uptime summary (§11). */
export function buildStatusEmbed(snapshot: ControllerSnapshot): EmbedBuilder {
  const openSession = snapshot.sessions.some((s) => s.disconnectedAt === null);
  return new EmbedBuilder()
    .setTitle('NeoBot status')
    .setColor(STATUS_COLOR[snapshot.status])
    .addFields(
      { name: 'Connection', value: snapshot.status, inline: true },
      { name: 'Activity', value: snapshot.currentActivity ?? 'idle', inline: true },
      { name: 'Uptime', value: `${snapshot.uptimePercent.toFixed(1)}%`, inline: true },
      { name: 'Players nearby', value: String(snapshot.playerCount), inline: true },
      { name: 'Memory', value: mb(snapshot.resource.rssBytes), inline: true },
      { name: 'Session', value: openSession ? 'connected' : 'none open', inline: true },
      { name: 'Paused', value: snapshot.paused ? 'yes' : 'no', inline: true },
      { name: 'Safe Mode', value: snapshot.safeMode ? 'on' : 'off', inline: true },
      { name: 'Updated', value: rel(snapshot.lastUpdated), inline: true },
    );
}

/** `/config` — current non-secret config summary (§11). */
export function buildConfigSummary(config: AppConfig): EmbedBuilder {
  const c = config.connection;
  const b = config.behavior;
  const enabledBehaviors = Object.entries(b.behaviors)
    .filter(([, s]) => s.enabled)
    .map(([name]) => name);
  const extraAuth =
    [config.auth.tokenUrl.enabled && 'token URL', config.auth.ipAllowlist.enabled && 'IP allowlist']
      .filter(Boolean)
      .join(', ') || 'login only';

  return new EmbedBuilder()
    .setTitle('NeoBot configuration')
    .setColor(BRAND)
    .addFields(
      {
        name: 'Server',
        value: c.host ? `${c.host}:${c.port}` : 'not set',
        inline: true,
      },
      { name: 'Version', value: c.version ?? 'auto-detect', inline: true },
      { name: 'Bot name', value: c.username ?? 'NeoBot', inline: true },
      {
        name: 'Safe zone',
        value:
          b.safeZone.x !== null && b.safeZone.z !== null
            ? `(${b.safeZone.x}, ${b.safeZone.z}) r${b.safeZone.radius}`
            : `spawn · r${b.safeZone.radius}`,
        inline: true,
      },
      {
        name: 'Block mode',
        value: b.blockInteraction.mode + (b.blockInteraction.boundless ? ' · boundless' : ''),
        inline: true,
      },
      { name: 'Chat', value: b.chat.enabled ? 'on' : 'off', inline: true },
      { name: 'Hazards', value: b.hazards.enabled ? 'on' : 'off', inline: true },
      {
        name: `Behaviors (${enabledBehaviors.length})`,
        value: enabledBehaviors.length ? enabledBehaviors.join(', ') : 'none',
        inline: false,
      },
      { name: 'Extra auth', value: extraAuth, inline: true },
    );
}

/** `/logs [lines]` — recent event tail as a code block (§11). */
export function buildLogsContent(events: EventRecord[], lines: number): string {
  if (events.length === 0) return 'No events recorded yet.';
  const rows = events
    .slice(0, lines)
    .map((e) => {
      const time = new Date(e.createdAt).toISOString().slice(11, 19);
      return `${time} [${e.level}] (${e.category}) ${e.message}`;
    })
    .join('\n');
  // Keep within Discord's 2000-char message limit.
  const clipped = rows.length > 1900 ? `${rows.slice(0, 1900)}\n…` : rows;
  return `\`\`\`\n${clipped}\n\`\`\``;
}

/** Alert push embed (§11). Colored by severity of the event key. */
export function formatAlertEmbed(event: AlertEvent): EmbedBuilder {
  const danger = ['banned', 'crash', 'reconnect_failed', 'fatal'];
  const warn = ['disconnected', 'kicked', 'anticheat', 'whitelist', 'low_memory', 'hibernating'];
  const color = danger.includes(event.key)
    ? DANGER
    : event.key === 'connected'
      ? OK
      : warn.includes(event.key)
        ? WARN
        : BRAND;

  const embed = new EmbedBuilder()
    .setTitle(`NeoBot · ${humanizeAlertKey(event.key)}`)
    .setColor(color)
    .setDescription(event.message)
    .setTimestamp(new Date());
  if (event.category) embed.addFields({ name: 'Category', value: event.category, inline: true });
  return embed;
}
