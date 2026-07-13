/** NeoBot wordmark + logo glyph. */
import { cn } from '../lib/cn.ts';

export function BrandGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="NeoBot logo">
      <rect width="32" height="32" rx="7" fill="#0a0e14" stroke="#24304a" />
      <g
        fill="none"
        stroke="#4fd8ff"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <rect x="8" y="10" width="16" height="13" rx="3" />
        <path d="M16 6v4" />
        <circle cx="16" cy="6" r="1.6" fill="#4fd8ff" stroke="none" />
      </g>
      <circle cx="13" cy="16" r="1.9" fill="#4fd8ff" />
      <circle cx="19" cy="16" r="1.9" fill="#4fd8ff" />
      <path d="M13 20h6" stroke="#2b8fb0" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandGlyph size={size} />
      <span className="text-lg font-semibold tracking-tight text-ink">
        Neo<span className="text-accent">Bot</span>
      </span>
    </div>
  );
}
