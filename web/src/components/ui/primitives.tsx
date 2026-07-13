/**
 * Brand UI primitives. Built to the NeoBot dark theme, not a generic kit.
 * Deliberately avoids the impeccable slop bans (identical card grids, tracked
 * eyebrows, gradient text, side-stripe borders, decorative glass).
 */
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import type { StatusTone } from '../../lib/format.ts';

// ---- Button ---------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const buttonBase =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-medium ' +
  'transition-[background,box-shadow,transform,color] duration-150 active:translate-y-px ' +
  'disabled:pointer-events-none disabled:opacity-45 cursor-pointer select-none';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-strong glow-accent font-semibold',
  secondary: 'bg-surface-2 text-ink border border-border hover:border-border-strong hover:bg-overlay',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
};

export function Button({
  variant = 'secondary',
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonBase, buttonVariants[variant], className)}
      disabled={disabled ?? loading}
      {...props}
    >
      {loading && <Spinner size={15} />}
      {children}
    </button>
  );
}

// ---- Panel ----------------------------------------------------------------

interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  action?: ReactNode;
  bodyClassName?: string;
}

export function Panel({ title, action, children, className, bodyClassName, ...props }: PanelProps) {
  return (
    <section
      className={cn('rounded-[var(--radius-lg)] border border-border bg-surface', className)}
      {...props}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          {typeof title === 'string' ? (
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
          ) : (
            title
          )}
          {action}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

// ---- Badge + StatusDot ----------------------------------------------------

const toneText: Record<StatusTone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  idle: 'text-idle',
  danger: 'text-danger',
  accent: 'text-accent',
};

const toneBg: Record<StatusTone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  idle: 'bg-idle',
  danger: 'bg-danger',
  accent: 'bg-accent',
};

export function Badge({
  tone = 'idle',
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        'border-current/25 bg-current/10',
        toneText[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone, pulse = false }: { tone: StatusTone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {pulse && (
        <span
          className={cn('absolute inline-flex h-full w-full rounded-full opacity-60', toneBg[tone])}
          style={{ animation: 'neo-ping 1.8s cubic-bezier(0,0,0.2,1) infinite' }}
        />
      )}
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', toneBg[tone])} />
    </span>
  );
}

// ---- Stat / Metric --------------------------------------------------------

export function Stat({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatusTone;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-faint">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn('font-mono text-2xl font-semibold tabular-nums', tone ? toneText[tone] : 'text-ink')}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

// ---- Spinner --------------------------------------------------------------

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
