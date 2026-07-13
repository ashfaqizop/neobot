/**
 * Live dashboard (masterdoc §8.4). Shows everything: connection state, uptime,
 * current activity, player count, RAM, reconnect history, control actions, and
 * the 2D minimap. Reads the shared live feed from the shell; fetches config once
 * for the minimap's safe-zone ring.
 */
import { useEffect, useState } from 'react';
import { useLive } from '../components/AppShell.tsx';
import { api } from '../lib/api.ts';
import type { AppConfig } from '../lib/types.ts';
import { formatBytes, formatDuration, formatRelative, formatTime, statusMeta } from '../lib/format.ts';
import { humanizeActivity, humanizeCategory, humanizeError } from '../lib/humanize.ts';
import { Badge, Button, Panel, Skeleton, Stat, StatusDot } from '../components/ui/primitives.tsx';
import { Toggle } from '../components/ui/form.tsx';
import { Minimap } from '../components/Minimap.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import {
  IconChip,
  IconPause,
  IconPlay,
  IconReconnect,
  IconRestart,
  IconUsers,
} from '../components/ui/icons.tsx';

export function Dashboard() {
  const { snapshot, loading, error, version } = useLive();
  const { push } = useToast();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);

  useEffect(() => {
    api
      .getConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  const run = async (name: string, fn: () => Promise<unknown>, message: string) => {
    setPending(name);
    try {
      await fn();
      push(message, 'accent');
    } catch (err) {
      push(humanizeError(err instanceof Error ? err.message : 'Action failed'), 'danger');
    } finally {
      setPending(null);
    }
  };

  if (loading && !snapshot) {
    return <DashboardSkeleton />;
  }

  if (!snapshot) {
    return (
      <Panel title="Dashboard">
        <p className="text-sm text-danger">{error ?? 'Unable to load live state.'}</p>
      </Panel>
    );
  }

  const meta = statusMeta(snapshot.status);
  const pulse = ['connected', 'connecting', 'reconnecting'].includes(snapshot.status);
  const paused = snapshot.paused;
  const openSessions = snapshot.sessions.filter((s) => s.disconnectedAt === null).length;

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusDot tone={meta.tone} pulse={pulse} />
          <div>
            <h1 className="text-xl font-semibold text-ink">{meta.label}</h1>
            <p className="text-sm text-muted">
              Currently: <span className="text-ink">{humanizeActivity(snapshot.currentActivity)}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {paused && <Badge tone="warn">Paused</Badge>}
          {snapshot.safeMode && <Badge tone="accent">Safe Mode</Badge>}
          {error && <Badge tone="danger">feed error</Badge>}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Panel bodyClassName="p-4">
          <Stat label="Uptime" value={`${snapshot.uptimePercent.toFixed(1)}%`} tone="ok" />
        </Panel>
        <Panel bodyClassName="p-4">
          <Stat
            label="Players nearby"
            value={snapshot.playerCount}
            icon={<IconUsers size={13} />}
            hint={snapshot.playerCount > 0 ? 'activity auto-pauses' : 'area clear'}
          />
        </Panel>
        <Panel bodyClassName="p-4">
          <Stat
            label="Memory (RSS)"
            value={formatBytes(snapshot.resource.rssBytes)}
            icon={<IconChip size={13} />}
            hint={`heap ${formatBytes(snapshot.resource.heapUsedBytes)}`}
          />
        </Panel>
        <Panel bodyClassName="p-4">
          <Stat
            label="Sessions"
            value={snapshot.sessions.length}
            hint={openSessions > 0 ? 'connected now' : 'none open'}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="flex flex-col gap-5">
          <Panel title="Controls">
            <div className="flex flex-wrap gap-2">
              {paused ? (
                <Button
                  variant="primary"
                  loading={pending === 'resume'}
                  onClick={() =>
                    void run('resume', () => api.control.resume(), 'Behaviors resumed')
                  }
                >
                  <IconPlay size={16} /> Resume
                </Button>
              ) : (
                <Button
                  loading={pending === 'pause'}
                  onClick={() => void run('pause', () => api.control.pause(), 'Behaviors paused')}
                >
                  <IconPause size={16} /> Pause
                </Button>
              )}
              <Button
                loading={pending === 'reconnect'}
                onClick={() =>
                  void run('reconnect', () => api.control.reconnect(), 'Reconnecting now')
                }
              >
                <IconReconnect size={16} /> Reconnect
              </Button>
              {confirmRestart ? (
                <Button
                  variant="danger"
                  loading={pending === 'restart'}
                  onClick={() => {
                    setConfirmRestart(false);
                    void run('restart', () => api.control.restart(), 'Connection restarting');
                  }}
                  onBlur={() => setConfirmRestart(false)}
                  autoFocus
                >
                  <IconRestart size={16} /> Confirm restart?
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setConfirmRestart(true)}>
                  <IconRestart size={16} /> Restart
                </Button>
              )}
            </div>
            <div className="mt-4 border-t border-border/70 pt-4">
              <Toggle
                checked={snapshot.safeMode}
                disabled={pending === 'safe'}
                onChange={(v) =>
                  void run('safe', () => api.control.safeMode(v), `Safe Mode ${v ? 'on' : 'off'}`)
                }
                label="Safe Mode"
                hint="Conservative activity. Automatic dial-back arrives in Phase 9."
              />
            </div>
          </Panel>

          <Panel title="Reconnect history">
            {snapshot.lastDisconnectReason && (
              <p className="mb-3 text-sm text-muted">
                Last disconnect:{' '}
                <span className="text-ink">{snapshot.lastDisconnectReason}</span>
              </p>
            )}
            {snapshot.reconnectHistory.length === 0 ? (
              <p className="text-sm text-faint">No reconnects recorded.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {[...snapshot.reconnectHistory]
                  .reverse()
                  .slice(0, 8)
                  .map((h, i) => (
                    <li
                      key={`${h.at}-${i}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge tone="idle">{humanizeCategory(h.category)}</Badge>
                        <span className="truncate text-muted" title={h.reason}>
                          {h.reason}
                        </span>
                      </span>
                      <span
                        className="shrink-0 font-mono text-xs text-faint tabular-nums"
                        title={formatTime(h.at)}
                      >
                        {formatRelative(h.at)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Right column — minimap + session */}
        <div className="flex flex-col gap-5">
          <Panel title="Live minimap">
            <Minimap
              position={snapshot.position}
              {...(config
                ? {
                    safeZone: {
                      x: config.behavior.safeZone.x,
                      z: config.behavior.safeZone.z,
                      radius: config.behavior.safeZone.radius,
                    },
                  }
                : {})}
            />
          </Panel>
          <Panel title="Current session">
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Since" value={formatDuration(snapshot.startedAt)} />
              <Row label="Last update" value={formatRelative(snapshot.lastUpdated)} />
              <Row label="Version" value={<span className="font-mono">{version ? `v${version}` : '—'}</span>} />
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-faint">{label}</dt>
      <dd className="font-mono text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-40" />
          <Skeleton className="h-56" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-80" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </div>
  );
}
