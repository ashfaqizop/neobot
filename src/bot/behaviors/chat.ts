/**
 * Filler chat (masterdoc §7).
 *
 * OFF by default — the safest choice on real, populated servers. When enabled,
 * sends a random line from the configurable message pool. The engine's random
 * cycle timing provides the "random interval" between messages.
 */
import type { AFKBehavior } from './types.js';
import { randomInt } from './humanize.js';

export const chat: AFKBehavior = {
  name: 'chat',
  enabledByDefault: false,
  weight: 1,
  canRun: (_state, config) => config.chat.enabled && config.chat.messages.length > 0,
  run(ctx) {
    const { bot, config, rng } = ctx;
    const messages = config.chat.messages;
    const msg = messages[randomInt(0, messages.length - 1, rng)]!;
    bot.chat(msg);
    return Promise.resolve();
  },
};
