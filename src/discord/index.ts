/**
 * Discord subsystem bootstrap (masterdoc §11).
 *
 * Toggleable and optional: with no token/guild configured it never starts, and
 * ANY failure here is swallowed (logged, returns null) so the keep-alive daemon
 * stays up. Registers guild-scoped slash commands on ready, routes interactions
 * to the shared BotController, and exposes a {@link DiscordAlerter} for pushes.
 */
import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  type Client as DiscordClient,
  type EmbedBuilder,
} from 'discord.js';
import { childLogger } from '../lib/logger.js';
import { env, hasDiscord } from '../config/env.js';
import type { BotController } from '../bot/controller.js';
import type { AppConfig } from '../config/appConfig.js';
import type { Repositories } from '../db/types.js';
import { commandData, handleInteraction, type CommandContext } from './commands.js';
import { DiscordAlerter, type EmbedSender } from './alerts.js';

const log = childLogger('discord');

export interface DiscordDeps {
  controller: BotController;
  repos: Repositories;
  getConfig: () => AppConfig;
}

export interface DiscordHandle {
  alerter: DiscordAlerter;
  stop: () => Promise<void>;
}

/** A channel we can post alert embeds to. */
interface AlertChannel {
  id: string;
  send(options: { embeds: EmbedBuilder[] }): Promise<unknown>;
}

export async function startDiscord(deps: DiscordDeps): Promise<DiscordHandle | null> {
  if (!hasDiscord()) {
    log.info('Discord subsystem disabled (no DISCORD_BOT_TOKEN / DISCORD_GUILD_ID)');
    return null;
  }
  const guildId = env.DISCORD_GUILD_ID!;

  try {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    const ctx: CommandContext = {
      controller: deps.controller,
      getConfig: deps.getConfig,
      events: deps.repos.events,
      alertSettings: deps.repos.alertSettings,
    };

    client.on(Events.InteractionCreate, (interaction) => {
      if (interaction.isChatInputCommand()) void handleInteraction(interaction, ctx);
    });

    let channel: AlertChannel | null = null;
    client.once(Events.ClientReady, (c) => {
      void onReady(c, guildId).then((resolved) => {
        channel = resolved;
      });
    });

    client.on(Events.Error, (err) => log.warn({ err }, 'Discord client error'));

    const send: EmbedSender = async (embed) => {
      if (channel) await channel.send({ embeds: [embed] });
    };
    const alerter = new DiscordAlerter(send, deps.repos.alertSettings);

    await client.login(env.DISCORD_BOT_TOKEN);
    return {
      alerter,
      stop: async () => {
        await client.destroy();
      },
    };
  } catch (err) {
    log.error({ err }, 'Discord subsystem failed to start — continuing without it');
    return null;
  }
}

async function onReady(client: DiscordClient<true>, guildId: string): Promise<AlertChannel | null> {
  try {
    await client.application.commands.set(commandData, guildId);
    client.user.setPresence({
      activities: [{ name: 'over your Minecraft server', type: ActivityType.Watching }],
      status: 'online',
    });
    const channel = await resolveAlertChannel(client, guildId);
    log.info({ tag: client.user.tag, alertChannel: channel?.id ?? 'none' }, 'Discord bot ready');
    return channel;
  } catch (err) {
    log.warn({ err }, 'Discord ready-setup failed (commands or channel)');
    return null;
  }
}

/** Env channel → guild system channel → first text channel we can post to. */
async function resolveAlertChannel(
  client: DiscordClient<true>,
  guildId: string,
): Promise<AlertChannel | null> {
  const guild = await client.guilds.fetch(guildId);

  if (env.DISCORD_ALERT_CHANNEL_ID) {
    const ch = await guild.channels.fetch(env.DISCORD_ALERT_CHANNEL_ID).catch(() => null);
    if (ch && ch.isTextBased()) return ch;
    log.warn({ id: env.DISCORD_ALERT_CHANNEL_ID }, 'Configured alert channel not usable — falling back');
  }

  if (guild.systemChannel) return guild.systemChannel;

  const channels = await guild.channels.fetch();
  for (const ch of channels.values()) {
    if (ch && ch.isTextBased()) return ch;
  }
  return null;
}
