/**
 * Authenticated app shell: persistent nav (sidebar on desktop, drawer on
 * mobile), a live connection-status pill in the top bar, and the routed page in
 * the main region. Owns the single {@link useLiveState} poll and hands it to
 * pages through the router Outlet context so there's exactly one data feed.
 */
import { useState } from 'react';
import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { cn } from '../lib/cn.ts';
import { useAuth } from '../lib/auth.tsx';
import { useLiveState, type LiveState } from '../lib/useLiveState.ts';
import { statusMeta } from '../lib/format.ts';
import { Brand } from './Brand.tsx';
import { Button, StatusDot } from './ui/primitives.tsx';
import {
  IconConfig,
  IconDashboard,
  IconLogs,
  IconLogout,
  IconMenu,
  IconClose,
} from './ui/icons.tsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/logs', label: 'Logs', icon: IconLogs, end: false },
  { to: '/config', label: 'Config', icon: IconConfig, end: false },
];

export function AppShell() {
  const live = useLiveState();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setDrawerOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent/12 text-accent'
                : 'text-muted hover:bg-surface-2 hover:text-ink',
            )
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  const account = (
    <div className="flex flex-col gap-3 border-t border-border/70 pt-4">
      <div className="px-1 text-xs text-faint">
        Signed in as <span className="font-medium text-muted">{user?.username}</span>
      </div>
      <Button variant="ghost" onClick={() => void logout()} className="justify-start">
        <IconLogout size={17} />
        Sign out
      </Button>
    </div>
  );

  return (
    <div className="min-h-dvh bg-base bg-grid">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col justify-between border-r border-border bg-surface/60 px-4 py-5 backdrop-blur lg:flex">
        <div className="flex flex-col gap-7">
          <Brand />
          {nav}
        </div>
        {account}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-base/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="animate-fade-in absolute inset-y-0 left-0 flex w-64 flex-col justify-between border-r border-border bg-surface px-4 py-5">
            <div className="flex flex-col gap-7">
              <div className="flex items-center justify-between">
                <Brand />
                <button
                  aria-label="Close menu"
                  onClick={() => setDrawerOpen(false)}
                  className="text-faint hover:text-ink"
                >
                  <IconClose />
                </button>
              </div>
              {nav}
            </div>
            {account}
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-base/85 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
              className="text-muted hover:text-ink lg:hidden"
            >
              <IconMenu />
            </button>
            <span className="lg:hidden">
              <Brand size={24} />
            </span>
          </div>
          <ConnectionPill live={live} />
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6">
          <Outlet context={live} />
        </main>
      </div>
    </div>
  );
}

function ConnectionPill({ live }: { live: LiveState }) {
  const status = live.snapshot?.status ?? 'not-configured';
  const meta = statusMeta(status);
  const pulse = status === 'connected' || status === 'connecting' || status === 'reconnecting';
  return (
    <div className="flex items-center gap-2.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm">
      <StatusDot tone={meta.tone} pulse={pulse} />
      <span className="font-medium text-ink">{meta.label}</span>
      <span
        className={cn('h-1.5 w-1.5 rounded-full', live.connected ? 'bg-ok' : 'bg-idle')}
        title={live.connected ? 'Live feed connected' : 'Live feed offline'}
      />
    </div>
  );
}

/** Access the shared live-state feed from a routed page. */
export function useLive(): LiveState {
  return useOutletContext<LiveState>();
}
