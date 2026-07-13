/**
 * 2D live minimap (masterdoc §8.4). Plots the bot's X/Z on a top-down canvas
 * grid with a fading movement trail and the safe-zone ring. Position is sampled
 * from the polled snapshot; the trail accumulates recent points.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { Point } from '../lib/types.ts';
import { computeView, project, type SafeZone } from './minimapProjection.ts';
import { formatCoord } from '../lib/format.ts';

const MAX_TRAIL = 80;
const SIZE = 320;

// Read design tokens once so canvas strokes match the theme.
const COLORS = {
  grid: 'rgba(79, 216, 255, 0.10)',
  gridStrong: 'rgba(79, 216, 255, 0.20)',
  ring: 'rgba(79, 216, 255, 0.35)',
  ringFill: 'rgba(79, 216, 255, 0.06)',
  trail: '#4fd8ff',
  bot: '#4fd8ff',
  botGlow: 'rgba(79, 216, 255, 0.55)',
};

export function Minimap({ position, safeZone }: { position: Point | null; safeZone?: SafeZone }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<Point[]>([]);

  // Accumulate the trail as the position changes meaningfully.
  const trail = trailRef.current;
  if (position) {
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(last.x - position.x, last.z - position.z) > 0.25) {
      trail.push(position);
      if (trail.length > MAX_TRAIL) trail.shift();
    }
  }

  const view = useMemo(
    () => computeView(position, safeZone),
    // Recompute view when the framing inputs change.
    [position?.x, position?.z, safeZone?.x, safeZone?.z, safeZone?.radius], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Grid.
    const step = SIZE / 8;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const p = Math.round(i * step) + 0.5;
      ctx.strokeStyle = i === 4 ? COLORS.gridStrong : COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, SIZE);
      ctx.moveTo(0, p);
      ctx.lineTo(SIZE, p);
      ctx.stroke();
    }

    // Safe-zone ring.
    if (safeZone && safeZone.radius > 0 && safeZone.x !== null && safeZone.z !== null) {
      const center = project(safeZone.x, safeZone.z, view, SIZE);
      const edge = project(safeZone.x + safeZone.radius, safeZone.z, view, SIZE);
      const r = Math.abs(edge.px - center.px);
      ctx.beginPath();
      ctx.arc(center.px, center.py, r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.ringFill;
      ctx.fill();
      ctx.strokeStyle = COLORS.ring;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Movement trail (older = fainter).
    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        const a = project(trail[i - 1]!.x, trail[i - 1]!.z, view, SIZE);
        const b = project(trail[i]!.x, trail[i]!.z, view, SIZE);
        ctx.globalAlpha = (i / trail.length) * 0.9;
        ctx.strokeStyle = COLORS.trail;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Bot marker.
    if (position) {
      const p = project(position.x, position.z, view, SIZE);
      ctx.shadowColor = COLORS.botGlow;
      ctx.shadowBlur = 12;
      ctx.fillStyle = COLORS.bot;
      ctx.beginPath();
      ctx.arc(p.px, p.py, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [position, safeZone, view, trail]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-[var(--radius-md)] border border-border bg-base">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          role="img"
          aria-label={
            position
              ? `Bot at X ${formatCoord(position.x)}, Z ${formatCoord(position.z)}`
              : 'Bot position unavailable'
          }
        />
        {!position && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-faint">
            Position unavailable
          </div>
        )}
      </div>
      <div className="flex gap-4 font-mono text-xs text-muted tabular-nums">
        <span>X {position ? formatCoord(position.x) : '—'}</span>
        <span>Y {position ? formatCoord(position.y) : '—'}</span>
        <span>Z {position ? formatCoord(position.z) : '—'}</span>
      </div>
    </div>
  );
}
