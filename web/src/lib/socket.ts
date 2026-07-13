/**
 * Socket.IO client — a module singleton for the whole SPA. Same origin, so the
 * session cookie authenticates the handshake automatically; a token-URL deep
 * link (`?token=`) is forwarded via `socket.auth` for cookieless access. The
 * socket lives for the app's lifetime; hooks add/remove listeners in effects
 * (React 19 StrictMode-safe), so we never tear down the shared connection.
 */
import { io, type Socket } from 'socket.io-client';
import type { StatusPayload } from './types.ts';

let socket: Socket | null = null;
let authToken: string | null = null;

/** Provide an access token for cookieless (token-URL) socket auth. */
export function setSocketToken(token: string | null): void {
  authToken = token;
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      ...(authToken ? { auth: { token: authToken } } : {}),
    });
  }
  return socket;
}

export type { StatusPayload };
