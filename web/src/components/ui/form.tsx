/**
 * Form primitives — visible labels, helper/error text below the field, clear
 * focus. Follows the ui-ux-pro-max forms guidance (labels not placeholders,
 * error near field, 44px touch targets).
 */
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn.ts';

const controlBase =
  'w-full rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 py-2.5 text-sm text-ink ' +
  'placeholder:text-faint transition-colors focus:border-accent focus:outline-none ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-muted">
        {label}
        {required && <span className="ml-1 text-accent">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-faint">{hint}</p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };
export function Input({ invalid, className, ...props }: InputProps) {
  return <input className={cn(controlBase, invalid && 'border-danger', className)} {...props} />;
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select className={cn(controlBase, 'cursor-pointer', className)} {...props}>
      {children}
    </select>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn(controlBase, 'min-h-24 resize-y font-mono', className)} {...props} />;
}

// ---- Toggle (switch) ------------------------------------------------------

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="flex-1 cursor-pointer select-none">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-faint">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          'disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer',
          checked ? 'bg-accent' : 'bg-surface-2 border border-border',
        )}
      >
        <span
          className={cn(
            'inline-block h-4.5 w-4.5 transform rounded-full bg-base shadow transition-transform',
            checked ? 'translate-x-5.5' : 'translate-x-1',
          )}
          style={{ height: '1.125rem', width: '1.125rem' }}
        />
      </button>
    </div>
  );
}
