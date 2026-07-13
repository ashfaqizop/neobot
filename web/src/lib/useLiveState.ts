/**
 * The dashboard's live data feed. Combines two channels:
 *   - polling `GET /api/state` (~2s) for the full snapshot: position (minimap),
 *     player count, RAM, sessions, reconnect history;
 *   - the Socket.IO `state` event for instant status/activity/uptime changes
 *     between polls (and to trigger an immediate re-poll on change).
 *
 * The polled snapshot is the source of truth; socket payloads patch the
 * fast-moving header fields so the UI feels live without waiting for the tick.
 */
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api.ts';
import { getSocket } from './socket.ts';
import type { ControllerSnapshot, StatusPayload } from './types.ts';

const POLL_MS = 2000;

export interface LiveState {
  snapshot: ControllerSnapshot | null;
  connected: boolean;
  error: string | null;
  /** App version, streamed from the Socket.IO status payload. */
  version: string | null;
  /** True until the first snapshot resolves. */
  loading: boolean;
}

export function useLiveState(): LiveState {
  const [snapshot, setSnapshot] = useState<ControllerSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async (): Promise<void> => {
      try {
        const next = await api.state();
        if (!mounted.current) return;
        setSnapshot(next);
        setError(null);
      } catch (err) {
        if (!mounted.current) return;
        // A 401 is handled globally (redirect); don't flash a scary message.
        if (!(err instanceof ApiError && err.status === 401)) {
          setError(err instanceof Error ? err.message : 'Failed to load state');
        }
      } finally {
        if (mounted.current) {
          setLoading(false);
          timer = setTimeout(() => void poll(), POLL_MS);
        }
      }
    };

    void poll();

    const socket = getSocket();
    const onConnect = (): void => {
      if (mounted.current) setConnected(true);
    };
    const onDisconnect = (): void => {
      if (mounted.current) setConnected(false);
    };
    const onState = (payload: StatusPayload): void => {
      if (!mounted.current) return;
      setVersion(payload.version);
      // Patch the fast-moving fields immediately; the next poll reconciles rest.
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              status: payload.status,
              currentActivity: payload.currentActivity,
              uptimePercent: payload.uptimePercent,
              lastUpdated: payload.lastUpdated,
            }
          : prev,
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state', onState);
    setConnected(socket.connected);

    return () => {
      mounted.current = false;
      if (timer) clearTimeout(timer);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state', onState);
    };
  }, []);

  return { snapshot, connected, error, version, loading };
}
