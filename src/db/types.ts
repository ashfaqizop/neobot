/**
 * Persistence domain types + repository interfaces (masterdoc §9).
 *
 * Each repository has two implementations behind these interfaces: a Supabase
 * one and an in-memory fallback. Callers depend only on the interface, so the
 * app behaves identically with or without Supabase configured.
 */
import type { AppConfig } from '../config/appConfig.js';
import type { StateSnapshot } from '../bot/state.js';

export type EventLevel = 'info' | 'warn' | 'error';

export interface EventInput {
  level: EventLevel;
  category: string;
  message: string;
  meta?: Record<string, unknown> | undefined;
}

export interface EventRecord extends EventInput {
  id: number;
  createdAt: string;
}

export interface SessionRow {
  id: number;
  connectedAt: string;
  disconnectedAt: string | null;
  disconnectReason: string | null;
}

export interface AdminUser {
  id: number;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface AlertSetting {
  eventKey: string;
  enabled: boolean;
}

/** Singleton app config (masterdoc §9 hybrid bootstrap flow). */
export interface ConfigRepository {
  /** Return the stored config, or persist + return `defaults` on first run. */
  getOrBootstrap(defaults: AppConfig): Promise<AppConfig>;
  get(): Promise<AppConfig | null>;
  save(config: AppConfig): Promise<void>;
}

/** Singleton live state, so the dashboard survives a mid-session restart. */
export interface LiveStateRepository {
  load(): Promise<StateSnapshot | null>;
  save(snapshot: StateSnapshot): Promise<void>;
}

export interface EventsRepository {
  append(event: EventInput): Promise<void>;
  recent(limit?: number): Promise<EventRecord[]>;
}

export interface SessionsRepository {
  start(connectedAt: string): Promise<number>;
  end(id: number, disconnectedAt: string, reason: string | null): Promise<void>;
  recent(limit?: number): Promise<SessionRow[]>;
}

export interface AdminUsersRepository {
  findByUsername(username: string): Promise<AdminUser | null>;
  create(username: string, passwordHash: string): Promise<AdminUser>;
  count(): Promise<number>;
}

export interface AlertSettingsRepository {
  list(): Promise<AlertSetting[]>;
  setEnabled(eventKey: string, enabled: boolean): Promise<void>;
  ensureDefaults(eventKeys: string[]): Promise<void>;
}

export interface Repositories {
  config: ConfigRepository;
  liveState: LiveStateRepository;
  events: EventsRepository;
  sessions: SessionsRepository;
  adminUsers: AdminUsersRepository;
  alertSettings: AlertSettingsRepository;
}
