import { describe, it, expect } from 'vitest';
import { applyWidths, applyAutoWidths, clampWidth, contentWidth, isResizable, MIN_COL_WIDTH, fitResize } from './sizing';
import type { ColumnDef } from './column';

const col = (over: Partial<ColumnDef> & { key: string }): ColumnDef =>
  ({ type: 'number', header: over.key, ...over }) as ColumnDef;

describe('clampWidth', () => {
  it('rounds to whole pixels', () => {
    expect(clampWidth(120.6)).toBe(121);
  });
  it('enforces the minimum width', () => {
    expect(clampWidth(10)).toBe(MIN_COL_WIDTH);
    expect(clampWidth(-50)).toBe(MIN_COL_WIDTH);
  });
  it('clamps to a per-column min and max', () => {
    expect(clampWidth(50, 80, 200)).toBe(80); // below min → min
    expect(clampWidth(300, 80, 200)).toBe(200); // above max → max
    expect(clampWidth(120, 80, 200)).toBe(120); // within → unchanged
  });
  it('never goes below the absolute MIN_COL_WIDTH even if min is smaller', () => {
    expect(clampWidth(10, 20, 200)).toBe(MIN_COL_WIDTH);
  });
});

describe('isResizable', () => {
  it('is true by default when the grid allows it', () => {
    expect(isResizable(col({ key: 'a' }), true)).toBe(true);
  });
  it('respects a per-column opt-out', () => {
    expect(isResizable(col({ key: 'a', resizable: false }), true)).toBe(false);
  });
  it('is false when the grid disables resizing', () => {
    expect(isResizable(col({ key: 'a' }), false)).toBe(false);
  });
});

describe('applyWidths', () => {
  it('returns the same array reference when no overrides apply', () => {
    const cols = [col({ key: 'a' }), col({ key: 'b' })];
    expect(applyWidths(cols, {})).toBe(cols);
  });

  it('sets the overridden width and clears flex', () => {
    const cols = [col({ key: 'a', flex: 1 }), col({ key: 'b', width: 80 })];
    const out = applyWidths(cols, { a: 200 });
    expect(out[0].width).toBe(200);
    expect(out[0].flex).toBeUndefined();
    // untouched column passes through by reference
    expect(out[1]).toBe(cols[1]);
  });

  it('does not mutate the input columns', () => {
    const cols = [col({ key: 'a', flex: 1 })];
    applyWidths(cols, { a: 150 });
    expect(cols[0].flex).toBe(1);
    expect(cols[0].width).toBeUndefined();
  });

  it('applies overrides keyed by column key regardless of position', () => {
    const cols = [col({ key: 'a' }), col({ key: 'b' }), col({ key: 'c' })];
    const out = applyWidths(cols, { c: 120, a: 64 });
    expect(out[0].width).toBe(64);
    expect(out[2].width).toBe(120);
    expect(out[1]).toBe(cols[1]);
  });
});

describe('applyAutoWidths (autoWidth)', () => {
  const cols: ColumnDef[] = [
    { type: 'number', key: 'px', header: 'Px', width: 70, autoWidth: true },
    { type: 'text', key: 'name', header: 'Name', flex: 1, minWidth: 80, autoWidth: true },
    { type: 'number', key: 'vol', header: 'Vol', width: 60, autoWidth: true, maxWidth: 90 },
    { type: 'number', key: 'off', header: 'Off', width: 50 },
  ];

  it('widens a fixed column and raises its floor to the measured width', () => {
    const out = applyAutoWidths(cols, { px: 96 }, {});
    expect(out[0]).toMatchObject({ width: 96, minWidth: 96 });
  });

  it('never narrows a column below its declared width', () => {
    expect(applyAutoWidths(cols, { px: 40 }, {})[0]).toMatchObject({ width: 70 });
  });

  it('raises only the floor of a flex column, which keeps flexing', () => {
    const out = applyAutoWidths(cols, { name: 150 }, {});
    expect(out[1]).toMatchObject({ flex: 1, minWidth: 150 });
    expect(out[1].width).toBeUndefined();
  });

  it('stops at maxWidth', () => {
    expect(applyAutoWidths(cols, { vol: 200 }, {})[2]).toMatchObject({ width: 90, minWidth: 90 });
  });

  it('leaves columns the user resized, and columns without autoWidth, alone', () => {
    const out = applyAutoWidths(cols, { px: 120, off: 120 }, { px: 64 });
    expect(out[0]).toBe(cols[0]);
    expect(out[3]).toBe(cols[3]);
  });

  it('returns the same array when nothing changes', () => {
    expect(applyAutoWidths(cols, {}, {})).toBe(cols);
  });
});

describe('contentWidth', () => {
  it('is the widest text plus padding, in whole pixels', () => {
    expect(contentWidth(['1.5', '100.05', '9'], (s) => s.length * 7.3, 18)).toBe(Math.ceil(6 * 7.3) + 18);
  });

  it('is just the padding with nothing to measure', () => {
    expect(contentWidth([], () => 10, 18)).toBe(18);
  });
});

describe('fitResize', () => {
  const drag = (at: number) => ({ keys: ['a', 'b', 'c'], widths: [100, 100, 100], floors: [40, 40, 40], at });

  it('the dragged column takes the pointer and the ones after it share the rest', () => {
    expect(fitResize(drag(0), 160)).toEqual({ a: 160, b: 70, c: 70 });
  });

  it('keeps the columns before the dragged one as they are', () => {
    expect(fitResize(drag(1), 140)).toEqual({ a: 100, b: 140, c: 60 });
  });

  it('the last column trades with the ones before it', () => {
    expect(fitResize(drag(2), 160)).toEqual({ a: 70, b: 70, c: 160 });
  });

  it('never pushes a column below its floor, nor the dragged one below its own', () => {
    expect(fitResize(drag(0), 1000)).toEqual({ a: 220, b: 40, c: 40 });
    expect(fitResize(drag(0), 10)).toEqual({ a: 40, b: 130, c: 130 });
  });
});
