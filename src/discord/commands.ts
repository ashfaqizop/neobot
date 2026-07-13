/**
 * Discord slash commands (masterdoc §11).
 *
 * `commandData` is the registration payload; `handleInteraction` routes an
 * invocation to the shared BotController / repositories / config. The handler is
 * typed against a minimal {@link SlashInteraction} structural interface (which
 * the real discord.js `ChatInputCommandInteraction` satisfies), so it's testable
 * with a plain fake — no live gateway.
 *
 * Commands are open to anyone in the guild in v1 (no role restriction) — a
 * documented known limitation (§11).
 */
import { SlashCommandBuilder, type EmbedBuilder } from 'discord.js';
import { childLogger } from '../lib/logger.js';
import type { BotController } from '../bot/controller.js';
import type { AppConfig } from '../config/appConfig.js';
import type { AlertSettingsRepository, EventsRepository } from '../db/types.js';
import {
  ALERT_KEYS,
  buildConfigSummary,
  buildLogsContent,
  buildStatusEmbed,
  humanizeAlertKey,
} from './presenters.js';

const log = childLogger('discord-commands');

export interface CommandContext {
  controller: BotController;
  getConfig: () => AppConfig;
  events: EventsRepository;
  alertSettings: AlertSettingsRepository;
}

/** The subset of a discord.js chat-input interaction we use. */
export interface SlashInteraction {
  commandName: string;
  options: {
    getString(name: string, required?: boolean): string | null;
    getInteger(name: string): number | null;
    getSubcommand(): string;
  };
  reply(options: { embeds?: EmbedBuilder[]; content?: string; ephemeral?: boolean }): Promise<unknown>;
}

const ALERT_CHOICES = ALERT_KEYS.map((k) => ({ name: humanizeAlertKey(k), value: k }));

/** Slash-command registration payload (guild-scoped). */
export const commandData = [
  new SlashCommandBuilder().setName('status').setDescription('Current connection, activity, and uptime'),
  new SlashCommandBuilder().setName('pause').setDescription('Pause all simulated activity'),
  new SlashCommandBuilder().setName('resume').setDescription('Resume simulated activity'),
  new SlashCommandBuilder().setName('restart').setDescription('Restart the Minecraft connection'),
  new SlashCommandBuilder().setName('reconnect').setDescription('Force an immediate reconnect'),
  new SlashCommandBuilder().setName('config').setDescription('View the current configuration summary'),
  new SlashCommandBuilder()
    .setName('safe-mode')
    .setDescription('Toggle Safe Mode')
    .addStringOption((o) =>
      o
        .setName('state')
        .setDescription('on or off')
        .setRequired(true)
        .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }),
    ),
  new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Show the recent log tail')
    .addIntegerOption((o) =>
      o.setName('lines').setDescription('How many lines (default 10, max 30)').setMinValue(1).setMaxValue(30),
    ),
  new SlashCommandBuilder()
    .setName('alerts')
    .setDescription('View or mute per-event alerts')
    .addSubcommand((s) => s.setName('view').setDescription('List alert toggles'))
    .addSubcommand((s) =>
      s
        .setName('mute')
        .setDescription('Mute an alert')
        .addStringOption((o) =>
          o
            .setName('event')
            .setDescription('Which alert')
            .setRequired(true)
            .addChoices(...ALERT_CHOICES),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('unmute')
        .setDescription('Unmute an alert')
        .addStringOption((o) =>
          o
            .setName('event')
            .setDescription('Which alert')
            .setRequired(true)
            .addChoices(...ALERT_CHOICES),
        ),
    ),
].map((b) => b.toJSON());

/** Route a slash-command invocation to the shared control surface. */
export async function handleInteraction(
  interaction: SlashInteraction,
  ctx: CommandContext,
): Promise<void> {
  const { controller } = ctx;
  try {
    switch (interaction.commandName) {
      case 'status':
        await interaction.reply({ embeds: [buildStatusEmbed(controller.snapshot())] });
        return;
      case 'pause':
        controller.pause();
        await interaction.reply({ content: '⏸️ Behaviors paused.' });
        return;
      case 'resume':
        controller.resume();
        await interaction.reply({ content: '▶️ Behaviors resumed.' });
        return;
      case 'restart':
        controller.restart();
        await interaction.reply({ content: '🔄 Restarting the Minecraft connection…' });
        return;
      case 'reconnect':
        controller.reconnect();
        await interaction.reply({ content: '🔌 Reconnecting now…' });
        return;
      case 'safe-mode': {
        const on = interaction.options.getString('state', true) === 'on';
        controller.setSafeMode(on);
        await interaction.reply({ content: `🛡️ Safe Mode ${on ? 'enabled' : 'disabled'}.` });
        return;
      }
      case 'config':
        await interaction.reply({ embeds: [buildConfigSummary(ctx.getConfig())] });
        return;
      case 'logs': {
        const lines = interaction.options.getInteger('lines') ?? 10;
        const events = await ctx.events.recent(lines);
        await interaction.reply({ content: buildLogsContent(events, lines) });
        return;
      }
      case 'alerts':
        await handleAlerts(interaction, ctx);
        return;
      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  } catch (err) {
    log.warn({ err, command: interaction.commandName }, 'Command handler failed');
    // Best-effort error reply; ignore if the interaction already responded.
    await interaction.reply({ content: '⚠️ Something went wrong.', ephemeral: true }).catch(() => undefined);
  }
}

async function handleAlerts(interaction: SlashInteraction, ctx: CommandContext): Promise<void> {
  const sub = interaction.options.getSubcommand();
  if (sub === 'view') {
    const settings = await ctx.alertSettings.list();
    const byKey = new Map(settings.map((s) => [s.eventKey, s.enabled]));
    const lines = ALERT_KEYS.map(
      (k) => `${(byKey.get(k) ?? true) ? '🔔' : '🔕'} ${humanizeAlertKey(k)}`,
    ).join('\n');
    await interaction.reply({ content: lines });
    return;
  }
  const event = interaction.options.getString('event', true) ?? '';
  const enabled = sub === 'unmute';
  await ctx.alertSettings.setEnabled(event, enabled);
  await interaction.reply({
    content: `${enabled ? '🔔 Unmuted' : '🔕 Muted'} **${humanizeAlertKey(event)}** alerts.`,
  });
}
