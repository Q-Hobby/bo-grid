import { describe, it, expect } from 'vitest';
import { applyWidths, applyAutoWidths, clampWidth, contentWidth, frozenWidths, isResizable, MIN_COL_WIDTH } from './sizing';
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

describe('frozenWidths', () => {
  const cols = [col({ key: 'a', width: 100 }), col({ key: 'b', flex: 1 }), col({ key: 'c', flex: 2 })];

  it('takes each column at the width it has on screen, in whole pixels that never add up to more', () => {
    const shown = [100, 233.6, 466.4];
    // 800 exactly: floors 100 + 233 + 466 = 799, and the spare pixel goes back.
    expect(frozenWidths(cols, (i) => shown[i], [100, 64, 64])).toEqual({ a: 101, b: 233, c: 466 });
    const half = [100, 233.5, 466.5];
    const w = frozenWidths(cols, (i) => half[i], [100, 64, 64]);
    expect(w.a + w.b + w.c).toBe(800);
  });

  it('holds only the columns it is asked to (flex ones, by default in the grid)', () => {
    const shown = [100, 233, 467];
    expect(frozenWidths(cols, (i) => shown[i], [100, 64, 64], (c) => !!c.flex)).toEqual({ b: 233, c: 467 });
  });

  it('falls back to the layout width for a column not measured (or not laid out)', () => {
    expect(frozenWidths(cols, (i) => (i === 1 ? 0 : undefined), [100, 64, 64])).toEqual({ a: 100, b: 64, c: 64 });
  });
});
