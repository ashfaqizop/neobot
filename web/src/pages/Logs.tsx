/**
 * Logs (masterdoc §8.4): the recent event tail and session history, timestamps
 * localized to the viewer's timezone. Auto-refreshes on an interval.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import type { EventLevel, EventRecord, SessionRow } from '../lib/types.ts';
import type { StatusTone } from '../lib/format.ts';
import { formatDuration, formatRelative, formatTime } from '../lib/format.ts';
import { Badge, Button, Panel, Spinner } from '../components/ui/primitives.tsx';

const REFRESH_MS = 5000;
const LEVEL_TONE: Record<EventLevel, StatusTone> = { info: 'idle', warn: 'warn', error: 'danger' };

export function Logs() {
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [tab, setTab] = useState<'events' | 'sessions'>('events');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [ev, se] = await Promise.all([api.logs(150), api.sessions(60)]);
      setEvents(ev);
      setSessions(se);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface p-1">
          <TabButton active={tab === 'events'} onClick={() => setTab('events')}>
            Events
          </TabButton>
          <TabButton active={tab === 'sessions'} onClick={() => setTab('sessions')}>
            Sessions
          </TabButton>
        </div>
        <Button variant="ghost" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error && (
        <Panel>
          <p className="text-sm text-danger">{error}</p>
        </Panel>
      )}

      {tab === 'events' ? (
        <Panel title="Recent events" bodyClassName="p-0">
          {events === null ? (
            <Loading />
          ) : events.length === 0 ? (
            <Empty message="No events recorded yet." />
          ) : (
            <ul className="divide-y divide-border/60">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                  <Badge tone={LEVEL_TONE[e.level]}>{e.level}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      <span className="font-mono text-xs text-faint">[{e.category}]</span>{' '}
                      {e.message}
                    </p>
                  </div>
                  <span
                    className="shrink-0 font-mono text-xs text-faint tabular-nums"
                    title={formatTime(e.createdAt)}
                  >
                    {formatRelative(e.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : (
        <Panel title="Session history" bodyClassName="p-0">
          {sessions === null ? (
            <Loading />
          ) : sessions.length === 0 ? (
            <Empty message="No sessions recorded yet." />
          ) : (
            <ul className="divide-y divide-border/60">
              {sessions.map((s) => {
                const open = s.disconnectedAt === null;
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        {formatTime(s.connectedAt)}
                        {open ? (
                          <Badge tone="ok" className="ml-2">
                            live
                          </Badge>
                        ) : (
                          <span className="text-faint"> → {formatTime(s.disconnectedAt!)}</span>
                        )}
                      </p>
                      {s.disconnectReason && (
                        <p className="mt-0.5 text-xs text-muted">Ended: {s.disconnectReason}</p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-xs text-faint tabular-nums">
                      {open
                        ? formatDuration(s.connectedAt)
                        : formatDuration(s.connectedAt, new Date(s.disconnectedAt!).getTime())}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'cursor-pointer rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-sm font-medium transition-colors ' +
        (active ? 'bg-accent/15 text-accent' : 'text-muted hover:text-ink')
      }
    >
      {children}
    </button>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-12 text-accent">
      <Spinner size={20} />
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="px-4 py-10 text-center text-sm text-faint">{message}</p>;
}
