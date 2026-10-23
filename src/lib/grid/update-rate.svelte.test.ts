// @vitest-environment jsdom
// updateMs: under patchRows a column repaints at most every so many ms. The
// row is written at once, and the other columns repaint at once.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import type { ColumnDef } from './column';
import { mountGrid, type MountedGrid } from './test-fixtures/mount-grid';

let grid: MountedGrid | null = null;
beforeEach(() => vi.useFakeTimers({ now: 1000 }));
afterEach(() => {
  grid?.destroy();
  grid = null;
  vi.useRealTimers();
});

const rows = () => [
  { id: 1, sym: 'AAA', px: 10, tv: 100 },
  { id: 2, sym: 'BBB', px: 20, tv: 200 },
];
const cell = (sym: string, col: number) =>
  [...grid!.target.querySelectorAll('.viewport .row')]
    .find((r) => r.querySelector('[aria-colindex="1"]')?.textContent?.trim() === sym)!
    .querySelector(`[aria-colindex="${col}"]`)!;
const text = (sym: string, col: number) => cell(sym, col).textContent?.trim();
const patch = (p: Record<string, unknown>) => {
  grid!.api().patchRows([[1, p]]);
  flushSync();
};
const wait = (ms: number) => {
  vi.advanceTimersByTime(ms);
  flushSync();
};

describe('updateMs', () => {
  it('repaints the column at most once per beat; the row and the other columns update at once', () => {
    const columns: ColumnDef[] = [
      { type: 'text', key: 'sym', header: 'Sym' },
      { type: 'number', key: 'px', header: 'Px', decimals: 0 },
      { type: 'number', key: 'tv', header: 'Vol', decimals: 0, updateMs: 200 },
    ];
    grid = mountGrid({ rows: rows(), columns });
    // After a quiet spell: at once.
    patch({ px: 11, tv: 101 });
    expect(text('AAA', 2)).toBe('11');
    expect(text('AAA', 3)).toBe('101');
    wait(50);
    patch({ px: 12, tv: 102 });
    wait(50);
    patch({ px: 13, tv: 103 });
    expect(text('AAA', 2)).toBe('13');
    expect(text('AAA', 3)).toBe('101');
    expect(grid.rows[0].tv).toBe(103);
    // The beat, 200 ms after the last repaint: the latest value.
    wait(99);
    expect(text('AAA', 3)).toBe('101');
    wait(1);
    expect(text('AAA', 3)).toBe('103');
  });

  it('flashes on the repaint, against the value shown before', () => {
    const columns: ColumnDef[] = [
      { type: 'text', key: 'sym', header: 'Sym' },
      { type: 'number', key: 'tv', header: 'Vol', decimals: 0, flash: 'change', updateMs: 200 },
    ];
    grid = mountGrid({ rows: rows(), columns });
    const flashOf = () => cell('AAA', 2).querySelector('.flash');
    patch({ tv: 101 });
    // A flash's second play alternates its keyframes (`alt`), so the class
    // tells one flash from the next.
    const first = flashOf()?.classList.contains('alt');
    expect(flashOf()).not.toBeNull();
    wait(100);
    patch({ tv: 102 });
    expect(flashOf()?.classList.contains('alt')).toBe(first);
    wait(100);
    expect(text('AAA', 2)).toBe('102');
    expect(flashOf()?.classList.contains('alt')).toBe(!first);
  });

  it('a column without updateMs repaints on every tick, as before', () => {
    const columns: ColumnDef[] = [
      { type: 'text', key: 'sym', header: 'Sym' },
      { type: 'number', key: 'tv', header: 'Vol', decimals: 0 },
    ];
    grid = mountGrid({ rows: rows(), columns });
    patch({ tv: 101 });
    wait(10);
    patch({ tv: 102 });
    expect(text('AAA', 2)).toBe('102');
  });
});
