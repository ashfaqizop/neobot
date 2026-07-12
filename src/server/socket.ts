/**
 * Socket.IO live bridge (masterdoc §5, §8.4).
 *
 * Pushes live-state updates to authenticated dashboard clients in real time.
 * Handshake auth reuses the exact same {@link authorize} decision as the HTTP
 * middleware, so the two can't drift. A client authenticates with either the
 * session cookie (sent automatically) or an access token in `socket.auth.token`.
 */
import type { Server as HttpServer } from 'node:http';
import { Server as IoServer } from 'socket.io';
import { childLogger } from '../lib/logger.js';
import type { LiveStateStore } from '../bot/state.js';
import type { StatusPayload } from '../bot/types.js';
import { authorize, type ConfigProvider } from './auth/index.js';

const log = childLogger('socket');

export interface SocketDeps {
  state: LiveStateStore;
  getConfig: ConfigProvider;
}

export function attachSocket(server: HttpServer, deps: SocketDeps): IoServer {
  const io = new IoServer(server, { cors: { origin: false } });

  io.use((socket, next) => {
    const handshakeAuth = socket.handshake.auth as { token?: string } | undefined;
    const result = authorize(
      {
        ip: socket.handshake.address,
        cookieHeader: socket.handshake.headers.cookie,
        token: handshakeAuth?.token,
      },
      deps.getConfig(),
    );
    if (result.ok) {
      next();
    } else {
      next(new Error(result.status === 403 ? 'forbidden' : 'unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // Send the current state immediately on connect.
    socket.emit('state', deps.state.getStatusPayload());
  });

  // Broadcast every live-state change to all connected (authed) clients.
  const onUpdate = (payload: StatusPayload): void => {
    io.emit('state', payload);
  };
  deps.state.on('update', onUpdate);

  io.on('close', () => deps.state.off('update', onUpdate));

  log.info('Socket.IO live bridge attached');
  return io;
}
