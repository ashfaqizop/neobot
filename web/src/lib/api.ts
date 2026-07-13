/**
 * Typed API client for the NeoBot backend (`/api/*`, Phase 6). Same-origin, so
 * the session cookie is sent automatically — no tokens to juggle. Non-2xx
 * responses throw {@link ApiError}; a 401 additionally fires the registered
 * unauthorized handler so the app can bounce to the login screen from anywhere
 * (including background polls).
 */
import type {
  AppConfig,
  AuthUser,
  ControllerSnapshot,
  EventRecord,
  SessionRow,
  SetupStatus,
} from './types.ts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let onUnauthorized: (() => void) | null = null;
/** Register a callback invoked whenever the API returns 401 (except on login). */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

let accessToken: string | null = null;
/** Set a token-URL access token; forwarded as `X-Access-Token` on every request. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Suppress the global 401 handler (used by the login call itself). */
  allowUnauthorized?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(accessToken ? { 'X-Access-Token': accessToken } : {}),
    },
  };
  if (opts.body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(0, 'Network error — is the server reachable?');
  }

  if (res.status === 401 && !opts.allowUnauthorized) onUnauthorized?.();

  const text = await res.text();
  const data: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    const message = errorMessage(data) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(data: unknown): string | null {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as { error: unknown }).error;
    if (typeof err === 'string') return err;
  }
  return null;
}

export const api = {
  // Setup / auth
  setupStatus: () => request<SetupStatus>('/api/setup/status'),
  runSetup: (payload: unknown) =>
    request<{ ok: true }>('/api/setup', { method: 'POST', body: payload }),
  me: () => request<AuthUser>('/api/auth/me'),
  login: (username: string, password: string) =>
    request<{ ok: true; username: string }>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
      allowUnauthorized: true,
    }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),

  // Dashboard data
  state: () => request<ControllerSnapshot>('/api/state'),
  logs: (limit = 100) => request<EventRecord[]>(`/api/logs?limit=${limit}`),
  sessions: (limit = 50) => request<SessionRow[]>(`/api/sessions?limit=${limit}`),

  // Config
  getConfig: () => request<AppConfig>('/api/config'),
  putConfig: (config: AppConfig) =>
    request<{ ok: true }>('/api/config', { method: 'PUT', body: config }),
  importConfig: (config: AppConfig) =>
    request<{ ok: true }>('/api/config/import', { method: 'POST', body: config }),

  // Control
  control: {
    pause: () => request<{ ok: true; paused: boolean }>('/api/control/pause', { method: 'POST' }),
    resume: () => request<{ ok: true; paused: boolean }>('/api/control/resume', { method: 'POST' }),
    restart: () => request<{ ok: true }>('/api/control/restart', { method: 'POST' }),
    reconnect: () => request<{ ok: true }>('/api/control/reconnect', { method: 'POST' }),
    safeMode: (enabled: boolean) =>
      request<{ ok: true; safeMode: boolean }>('/api/control/safe-mode', {
        method: 'POST',
        body: { enabled },
      }),
  },
};
