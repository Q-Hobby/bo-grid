// @vitest-environment jsdom
// Rows added and removed by assigning a new `rows` array: the row index and,
// with liveSort, the sorted view follow the diff instead of being rebuilt.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Grid from './Grid.svelte';
import type { ColumnDef, GridRow, SortState } from './column';
import { sortRows } from './column';
import type { GridApi } from './api';
import './test-fixtures/mount-grid'; // jsdom stubs (ResizeObserver)

const columns: ColumnDef[] = [
  { type: 'text', key: 'sym', header: 'Sym' },
  { type: 'number', key: 'px', header: 'Px', decimals: 0 },
];
const byPx: SortState[] = [{ key: 'px', dir: 'desc' }];

function prng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

let stop: (() => void) | null = null;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  stop?.();
  stop = null;
  vi.useRealTimers();
});

/** A grid tall enough to render every row, with reactive props. */
function setup(initial: GridRow[], extra: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
  let api: GridApi | undefined;
  const props = $state({ columns, rows: initial, height: 4000, sort: byPx, onReady: (a: GridApi) => (api = a), ...extra });
  const grid = mount(Grid, { target, props });
  flushSync();
  stop = () => {
    unmount(grid);
    target.remove();
  };
  const shown = () =>
    [...target.querySelectorAll('.spacer > .row')]
      .sort((a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')))
      .map((r) => r.querySelector('[aria-colindex="1"]')?.textContent?.trim());
  return { props, api: () => api!, shown, target };
}

describe('rows assigned with adds and removes', () => {
  it('with liveSort, the view stays equal to a full sort through random frames', () => {
    const rand = prng(21);
    let next = 0;
    const row = () => ({ id: next, sym: `S${next++}`, px: Math.floor(rand() * 50) });
    const g = setup(Array.from({ length: 40 }, row), { liveSort: 100 });
    for (let frame = 0; frame < 30; frame++) {
      // Ticks on a few rows, then a few rows in and out, as a new array.
      const live = g.props.rows;
      const patches: Array<[number, Record<string, unknown>]> = [];
      for (let k = 0; k < 3; k++) {
        const r = live[Math.floor(rand() * live.length)];
        patches.push([r.id as number, { px: Math.floor(rand() * 50) }]);
      }
      g.api().patchRows(patches);
      const gone = new Set(Array.from({ length: Math.floor(rand() * 3) }, () => live[Math.floor(rand() * live.length)]));
      const kept = live.filter((r) => !gone.has(r));
      const added = Array.from({ length: Math.floor(rand() * 3) }, row);
      g.props.rows = rand() < 0.5 ? [...kept, ...added] : [...added, ...kept];
      flushSync();
      vi.advanceTimersByTime(100);
      flushSync();
      expect(g.shown()).toEqual(sortRows(g.props.rows, byPx, columns).map((r) => r.sym));
    }
  });

  it('with liveSort and a footer, the totals stay equal to a full sum through random frames', () => {
    const rand = prng(8);
    let next = 0;
    const row = () => ({ id: next, sym: `S${next++}`, px: Math.floor(rand() * 50) });
    const cols: ColumnDef[] = [columns[0], { ...columns[1], groupAgg: 'sum' }];
    const g = setup(Array.from({ length: 30 }, row), { liveSort: 100, footer: true, columns: cols });
    const footerSum = () => g.target.querySelector('.footer')?.textContent?.match(/\d+/g)?.map(Number).pop();
    for (let frame = 0; frame < 25; frame++) {
      const live = g.props.rows;
      const r = live[Math.floor(rand() * live.length)];
      g.api().patchRows([[r.id as number, { px: Math.floor(rand() * 50) }]]);
      const gone = live[Math.floor(rand() * live.length)];
      g.props.rows = [...live.filter((x) => x !== gone), row()];
      flushSync();
      vi.advanceTimersByTime(100);
      flushSync();
      expect(footerSum()).toBe(g.props.rows.reduce((a, x) => a + (x.px as number), 0));
    }
  });

  it('without liveSort, a new array re-sorts as before', () => {
    const rows = [
      { id: 1, sym: 'A', px: 1 },
      { id: 2, sym: 'B', px: 2 },
    ];
    const g = setup(rows);
    rows[0].px = 9; // changed in place, outside patchRows
    g.props.rows = [...rows, { id: 3, sym: 'C', px: 5 }];
    flushSync();
    expect(g.shown()).toEqual(['A', 'C', 'B']);
  });

  it('a reordered array rebuilds', () => {
    const rows = [
      { id: 1, sym: 'A', px: 1 },
      { id: 2, sym: 'B', px: 1 },
      { id: 3, sym: 'C', px: 1 },
    ];
    const g = setup(rows, { liveSort: 100 });
    expect(g.shown()).toEqual(['A', 'B', 'C']); // ties keep the rows' order
    g.props.rows = [rows[2], rows[0], rows[1]];
    flushSync();
    expect(g.shown()).toEqual(['C', 'A', 'B']);
  });

  it('the row index follows: a new row takes patches, a removed one is gone, a removed pinned row unpins from view', () => {
    const rows = [
      { id: 1, sym: 'A', px: 1 },
      { id: 2, sym: 'B', px: 2 },
    ];
    const g = setup(rows, { rowPinning: true });
    g.api().pinRow(1);
    flushSync();
    expect(g.target.querySelector('.pinned-top')?.textContent).toContain('A');
    const added = { id: 3, sym: 'C', px: 3 };
    g.props.rows = [rows[1], added];
    flushSync();
    expect(g.api().patchRows([[3, { px: 30 }]])).toBe(1);
    expect(g.props.rows[1].px).toBe(30); // the rows live in a $state prop here: read them through it
    expect(g.api().patchRows([[1, { px: 10 }]])).toBe(0);
    expect(g.target.querySelector('.pinned-top')).toBeNull(); // the pinned row left with its data
    expect(g.api().pinRow(1)).toBe(false);
  });

  it('rows without ids, or with duplicate ids, diff by the row objects', () => {
    const noIds = [
      { sym: 'A', px: 3 },
      { sym: 'B', px: 2 },
      { sym: 'C', px: 1 },
    ] as unknown as GridRow[];
    const g = setup(noIds, { liveSort: 100 });
    g.props.rows = [noIds[1], noIds[2]];
    flushSync();
    expect(g.shown()).toEqual(['B', 'C']);
    stop?.();
    const dupes = [
      { id: 7, sym: 'A', px: 3 },
      { id: 7, sym: 'B', px: 2 },
      { id: 8, sym: 'C', px: 1 },
    ];
    const h = setup(dupes, { liveSort: 100 });
    h.props.rows = [dupes[1], dupes[2], { id: 9, sym: 'D', px: 9 }];
    flushSync();
    expect(h.shown()).toEqual(['D', 'B', 'C']);
  });

  it('a removed row whose id changed in place leaves no stale index entry', () => {
    const rows = [
      { id: 1, sym: 'A', px: 1 },
      { id: 2, sym: 'B', px: 2 },
      { id: 3, sym: 'C', px: 3 },
    ];
    const g = setup(rows);
    g.props.rows[0].id = 10; // the id changes in place, then the row is removed
    g.props.rows = [g.props.rows[1], g.props.rows[2]];
    flushSync();
    expect(g.api().patchRows([[1, { px: 5 }]])).toBe(0);
    expect(g.api().patchRows([[10, { px: 5 }]])).toBe(0);
    expect(g.api().patchRows([[2, { px: 5 }]])).toBe(1);
  });

  it('the index follows a $state array changed in place', () => {
    const g = setup([{ id: 1, sym: 'A', px: 1 }]);
    g.props.rows.push({ id: 2, sym: 'B', px: 2 });
    flushSync();
    expect(g.api().patchRows([[2, { px: 20 }]])).toBe(1);
  });

  it('switching to a source and back rebuilds the view', () => {
    const rows = [
      { id: 1, sym: 'A', px: 1 },
      { id: 2, sym: 'B', px: 2 },
    ];
    const g = setup(rows);
    expect(g.shown()).toEqual(['B', 'A']);
    (g.props as Record<string, unknown>).source = { getRows: async () => ({ rows: [], total: 0 }) };
    flushSync();
    g.props.rows[0].px = 9; // changed while the source was in charge
    (g.props as Record<string, unknown>).source = undefined;
    flushSync();
    expect(g.shown()).toEqual(['A', 'B']);
  });
});

