/**
 * Toast notifications. Non-blocking, `aria-live="polite"` (don't steal focus),
 * auto-dismiss in ~4s. Used for control-action feedback and save confirmations.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import type { StatusTone } from '../../lib/format.ts';
import { IconCheck, IconClose } from './icons.tsx';

interface Toast {
  id: number;
  message: string;
  tone: StatusTone;
}

interface ToastContextValue {
  push: (message: string, tone?: StatusTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message: string, tone: StatusTone = 'accent') => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, tone }]);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const toneRing: Record<StatusTone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  idle: 'text-muted',
  danger: 'text-danger',
  accent: 'text-accent',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[var(--radius-md)]',
        'border border-border bg-surface-2/95 px-4 py-3 text-sm text-ink shadow-lg backdrop-blur animate-fade-in',
      )}
      role="status"
    >
      <span className={toneRing[toast.tone]}>
        <IconCheck size={17} />
      </span>
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-faint hover:text-ink cursor-pointer"
      >
        <IconClose size={15} />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
