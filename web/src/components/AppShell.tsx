/**
 * Authenticated app shell: persistent nav (sidebar on desktop, drawer on
 * mobile), a live connection-status pill in the top bar, and the routed page in
 * the main region. Owns the single {@link useLiveState} poll and hands it to
 * pages through the router Outlet context so there's exactly one data feed.
 */
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { cn } from '../lib/cn.ts';
import { useAuth } from '../lib/auth.tsx';
import { api } from '../lib/api.ts';
import { useLiveState, type LiveState } from '../lib/useLiveState.ts';
import { statusMeta } from '../lib/format.ts';
import { Brand } from './Brand.tsx';
import { Button, StatusDot } from './ui/primitives.tsx';
import { useToast } from './ui/Toast.tsx';
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
  const navigate = useNavigate();
  const { push } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Keyboard accelerators (critique P2 — power-user efficiency). `g` then d/l/c
  // navigates; p toggles pause/resume; r reconnects; ? shows the shortcut sheet.
  const paused = live.snapshot?.paused ?? false;
  const gPending = useRef(false);
  useEffect(() => {
    const control = (fn: () => Promise<unknown>, msg: string) =>
      void fn()
        .then(() => push(msg, 'accent'))
        .catch(() => push('Action failed', 'danger'));

    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;

      if (gPending.current) {
        gPending.current = false;
        const dest = e.key === 'd' ? '/' : e.key === 'l' ? '/logs' : e.key === 'c' ? '/config' : null;
        if (dest) {
          void navigate(dest);
          return;
        }
      }
      switch (e.key) {
        case 'g':
          gPending.current = true;
          setTimeout(() => (gPending.current = false), 800);
          return;
        case '?':
          setHelpOpen((v) => !v);
          return;
        case 'Escape':
          setHelpOpen(false);
          setDrawerOpen(false);
          return;
        case 'p':
          return control(
            () => (paused ? api.control.resume() : api.control.pause()),
            paused ? 'Behaviors resumed' : 'Behaviors paused',
          );
        case 'r':
          return control(() => api.control.reconnect(), 'Reconnecting now');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, navigate, push]);

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
          <div className="flex items-center gap-2">
            <ConnectionPill live={live} />
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              className="hidden h-9 w-9 items-center justify-center rounded-full border border-border text-sm font-medium text-muted hover:text-ink sm:flex"
            >
              ?
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6">
          <Outlet context={live} />
        </main>
      </div>

      {helpOpen && <ShortcutSheet onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

const SHORTCUTS: Array<[string, string]> = [
  ['g d', 'Go to Dashboard'],
  ['g l', 'Go to Logs'],
  ['g c', 'Go to Config'],
  ['p', 'Pause / resume behaviors'],
  ['r', 'Reconnect now'],
  ['?', 'Toggle this help'],
];

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <button aria-label="Close" className="absolute inset-0 bg-base/70 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-fade-in relative w-full max-w-sm rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Keyboard shortcuts</h2>
          <button aria-label="Close" onClick={onClose} className="text-faint hover:text-ink">
            <IconClose size={16} />
          </button>
        </div>
        <dl className="flex flex-col gap-2.5">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={keys} className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="flex gap-1">
                {keys.split(' ').map((k) => (
                  <kbd
                    key={k}
                    className="min-w-[22px] rounded border border-border-strong bg-surface-2 px-1.5 py-0.5 text-center font-mono text-xs text-ink"
                  >
                    {k}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
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
