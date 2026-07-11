/**
 * Structured logging (masterdoc §4: pino).
 *
 * Emits structured JSON in production (ready to ship to log aggregators) and a
 * human-friendly pretty stream in development. In a later phase these logs are
 * also mirrored to the Supabase `events` table (masterdoc §9); that sink is
 * layered on top of this base logger rather than replacing it.
 */
import { pino } from 'pino';
import { env } from '../config/env.js';

const isDev = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'neobot' },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname,service',
          },
        },
      }
    : {}),
});

/** Create a child logger bound to a subsystem name (connection, behavior, ...). */
export const childLogger = (component: string) => logger.child({ component });

export type Logger = typeof logger;
