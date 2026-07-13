import { describe, expect, it } from 'vitest';
import { computeView, project } from './minimapProjection.ts';

describe('minimap projection', () => {
  it('places the view center at the canvas center', () => {
    const view = computeView({ x: 100, y: 64, z: 200 }, { x: 100, z: 200, radius: 32 });
    const { px, py } = project(100, 200, view, 320);
    expect(px).toBeCloseTo(160);
    expect(py).toBeCloseTo(160);
  });

  it('maps +X to the right and +Z downward', () => {
    const view = computeView(null, { x: 0, z: 0, radius: 40 });
    const east = project(view.halfSpan, 0, view, 320);
    const south = project(0, view.halfSpan, view, 320);
    expect(east.px).toBeGreaterThan(160); // +X → right
    expect(south.py).toBeGreaterThan(160); // +Z → down
  });

  it('frames the safe-zone radius with headroom', () => {
    const view = computeView(null, { x: 0, z: 0, radius: 40 });
    expect(view.halfSpan).toBeGreaterThan(40);
    expect(view.centerX).toBe(0);
    expect(view.centerZ).toBe(0);
  });

  it('expands the span to keep a far-flung bot on-canvas', () => {
    const view = computeView({ x: 500, y: 64, z: 0 }, { x: 0, z: 0, radius: 16 });
    expect(view.halfSpan).toBeGreaterThanOrEqual(500);
  });
});
