// @vitest-environment jsdom
// Trading staples: staleAfter (rows whose feed went quiet dim), pauseOnHover
// (live sort waits under the pointer) and flashNewRows (arrivals flash once).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Grid from './Grid.svelte';
import type { ColumnDef, GridRow } from './column';
import type { GridApi } from './api';
import './test-fixtures/mount-grid'; // jsdom stubs (ResizeObserver)

const columns: ColumnDef[] = [
  { type: 'text', key: 'sym', header: 'Sym' },
  { type: 'number', key: 'px', header: 'Px', decimals: 0 },
];
const rows = (): GridRow[] => [
  { id: 1, sym: 'AAA', px: 30 },
  { id: 2, sym: 'BBB', px: 20 },
  { id: 3, sym: 'CCC', px: 10 },
];

let stop: (() => void) | null = null;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  stop?.();
  stop = null;
  vi.useRealTimers();
});

function setup(extra: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.append(target);
  let api: GridApi | undefined;
  const props: { columns: ColumnDef[]; rows: GridRow[]; height: number; [prop: string]: unknown } = $state({ columns, rows: rows(), height: 400, onReady: (a: GridApi) => (api = a), ...extra });
  const grid = mount(Grid, { target, props });
  flushSync();
  stop = () => {
    unmount(grid);
    target.remove();
  };
  const rowEl = (sym: string) =>
    [...target.querySelectorAll('.spacer > .row')].find((r) => r.querySelector('[aria-colindex="1"]')?.textContent?.trim() === sym) as HTMLElement;
  const order = () =>
    [...target.querySelectorAll('.spacer > .row')]
      .sort((a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')))
      .map((r) => r.querySelector('[aria-colindex="1"]')?.textContent?.trim());
  const viewport = target.querySelector('.viewport') as HTMLElement;
  return { props, api: () => api!, rowEl, order, viewport };
}
const tick = (ms: number) => {
  vi.advanceTimersByTime(ms);
  flushSync();
};

describe('staleAfter', () => {
  it('dims rows the feed has not touched, and a tick brings a row back at once', () => {
    const g = setup({ staleAfter: 1000 });
    expect(g.rowEl('AAA').classList.contains('stale')).toBe(false);
    tick(1300);
    expect(g.rowEl('AAA').classList.contains('stale')).toBe(true);
    g.api().patchRows([[1, { px: 31 }]]);
    flushSync();
    expect(g.rowEl('AAA').classList.contains('stale')).toBe(false);
    expect(g.rowEl('BBB').classList.contains('stale')).toBe(true);
    tick(1300);
    expect(g.rowEl('AAA').classList.contains('stale')).toBe(true);
  });

  it('a row that arrives counts as fresh', () => {
    const g = setup({ staleAfter: 1000 });
    tick(1300);
    g.props.rows = [...g.props.rows, { id: 4, sym: 'DDD', px: 5 }];
    flushSync();
    tick(300);
    expect(g.rowEl('DDD').classList.contains('stale')).toBe(false);
    expect(g.rowEl('CCC').classList.contains('stale')).toBe(true);
  });

  it('off by default', () => {
    const g = setup({});
    tick(60_000);
    expect(g.rowEl('AAA').classList.contains('stale')).toBe(false);
  });

  it('rows loaded into an empty grid count from when they come, not from mount', () => {
    const g = setup({ staleAfter: 1000, rows: [] });
    tick(1300);
    g.props.rows = rows();
    flushSync();
    tick(300);
    expect(g.rowEl('AAA').classList.contains('stale')).toBe(false);
    tick(1000);
    expect(g.rowEl('AAA').classList.contains('stale')).toBe(true);
  });

  it('a rebuild (a reorder) only freshens the rows that are new', () => {
    const g = setup({ staleAfter: 1000 });
    tick(1300);
    const [a, b, c] = g.props.rows;
    g.props.rows = [{ id: 4, sym: 'DDD', px: 5 }, c, b, a];
    flushSync();
    tick(300);
    expect(g.rowEl('DDD').classList.contains('stale')).toBe(false);
    expect(g.rowEl('AAA').classList.contains('stale')).toBe(true);
  });

  it('a row pushed into a $state array counts from then', () => {
    const g = setup({ staleAfter: 1000, sort: [{ key: 'px', dir: 'desc' }] });
    tick(1300);
    g.props.rows.push({ id: 4, sym: 'DDD', px: 5 });
    flushSync();
    g.api().refresh(); // a sorted view follows an array changed in place on refresh
    tick(300);
    expect(g.rowEl('DDD').classList.contains('stale')).toBe(false);
    expect(g.rowEl('CCC').classList.contains('stale')).toBe(true);
    tick(1000);
    expect(g.rowEl('DDD').classList.contains('stale')).toBe(true);
  });

  it('a copy of a row (an immutable update) is news: the row comes back at once', () => {
    const g = setup({ staleAfter: 1000 });
    tick(1300);
    g.props.rows = g.props.rows.map((r) => (r.id === 1 ? { ...r, px: 31 } : r));
    flushSync();
    expect(g.rowEl('AAA').classList.contains('stale')).toBe(false);
    expect(g.rowEl('BBB').classList.contains('stale')).toBe(true);
  });

  it('a patch that changes nothing is not a tick', () => {
    const g = setup({ staleAfter: 1000 });
    tick(1300);
    g.api().patchRows([[1, { px: 30 }]]);
    flushSync();
    expect(g.rowEl('AAA').classList.contains('stale')).toBe(true);
  });

  it('pinnedRows, which no patch reaches, never dim', () => {
    const g = setup({ staleAfter: 1000, pinnedRows: [{ id: 'total', sym: 'TOT', px: 60 }] });
    tick(1300);
    const pinned = document.querySelector('.pinned-top .row') as HTMLElement;
    expect(pinned.textContent).toContain('TOT');
    expect(pinned.classList.contains('stale')).toBe(false);
    expect(g.rowEl('AAA').classList.contains('stale')).toBe(true);
  });

  it('turned on later, rows count from then', () => {
    const g = setup({});
    tick(5000);
    g.props.staleAfter = 1000;
    flushSync();
    tick(300);
    expect(g.rowEl('AAA').classList.contains('stale')).toBe(false);
    tick(1000);
    expect(g.rowEl('AAA').classList.contains('stale')).toBe(true);
  });

  it('turned on while flashNewRows tracks arrivals, patched rows are not dimmed', () => {
    const g = setup({ flashNewRows: true });
    tick(3000);
    g.api().patchRows([[1, { px: 31 }]]);
    g.props.staleAfter = 1000;
    flushSync();
    tick(300);
    expect(g.rowEl('AAA').classList.contains('stale')).toBe(false);
    expect(g.rowEl('BBB').classList.contains('stale')).toBe(false);
  });
});

describe('pauseOnHover', () => {
  const sorted = { sort: [{ key: 'px', dir: 'desc' as const }], liveSort: 100 };
  const enter = (el: HTMLElement, pointerType: string) => {
    const e = new MouseEvent('pointerenter') as MouseEvent & { pointerType: string };
    Object.defineProperty(e, 'pointerType', { value: pointerType });
    el.dispatchEvent(e);
  };

  it('live sort waits while a mouse is over the rows, and catches up when it leaves', () => {
    const g = setup(sorted);
    enter(g.viewport, 'mouse');
    g.api().patchRows([[3, { px: 99 }]]);
    tick(500);
    expect(g.order()).toEqual(['AAA', 'BBB', 'CCC']);
    g.viewport.dispatchEvent(new MouseEvent('pointerleave'));
    tick(100);
    expect(g.order()).toEqual(['CCC', 'AAA', 'BBB']);
  });

  it('the window losing focus or the tab hiding ends the pause', () => {
    const g = setup(sorted);
    enter(g.viewport, 'mouse');
    g.api().patchRows([[3, { px: 99 }]]);
    tick(300);
    expect(g.order()[0]).toBe('AAA');
    window.dispatchEvent(new Event('blur'));
    tick(100);
    expect(g.order()[0]).toBe('CCC');

    enter(g.viewport, 'mouse');
    g.api().patchRows([[2, { px: 100 }]]);
    tick(300);
    expect(g.order()[0]).toBe('CCC');
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    try {
      document.dispatchEvent(new Event('visibilitychange'));
    } finally {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    }
    tick(100);
    expect(g.order()[0]).toBe('BBB');
  });

  it('a touch does not pause it, nor does a mouse with pauseOnHover off', () => {
    const touch = setup(sorted);
    enter(touch.viewport, 'touch');
    touch.api().patchRows([[3, { px: 99 }]]);
    tick(100);
    expect(touch.order()[0]).toBe('CCC');
    stop?.();
    const off = setup({ ...sorted, pauseOnHover: false });
    enter(off.viewport, 'mouse');
    off.api().patchRows([[3, { px: 99 }]]);
    tick(100);
    expect(off.order()[0]).toBe('CCC');
  });
});

describe('flashNewRows', () => {
  it('a row that arrives flashes; the rows already there do not', () => {
    const g = setup({ flashNewRows: true });
    g.props.rows = [...g.props.rows, { id: 4, sym: 'DDD', px: 5 }];
    flushSync();
    flushSync();
    expect(g.rowEl('DDD').querySelector('.flash')).not.toBeNull();
    expect(g.rowEl('AAA').querySelector('.flash')).toBeNull();
  });

  it('off by default', () => {
    const g = setup({});
    g.props.rows = [...g.props.rows, { id: 4, sym: 'DDD', px: 5 }];
    flushSync();
    flushSync();
    expect(g.rowEl('DDD').querySelector('.flash')).toBeNull();
  });

  it('a copy of a row already there does not flash', () => {
    const g = setup({ flashNewRows: true });
    g.props.rows = g.props.rows.map((r) => (r.id === 1 ? { ...r, px: 31 } : r));
    flushSync();
    flushSync();
    expect(g.rowEl('AAA').querySelector('.flash')).toBeNull();
  });

  it('the first rows an empty grid gets do not flash; the next ones do', () => {
    const g = setup({ flashNewRows: true, rows: [] });
    g.props.rows = rows();
    flushSync();
    flushSync();
    expect(g.rowEl('AAA').querySelector('.flash')).toBeNull();
    g.props.rows = [...g.props.rows, { id: 4, sym: 'DDD', px: 5 }];
    flushSync();
    flushSync();
    expect(g.rowEl('DDD').querySelector('.flash')).not.toBeNull();
  });

  it('an emptied grid that fills again does not flash its rows', () => {
    const g = setup({ flashNewRows: true });
    g.props.rows = [];
    flushSync();
    g.props.rows = rows();
    flushSync();
    flushSync();
    expect(document.querySelector('.flash')).toBeNull();
  });

  it('a row that arrives and is patched in the same tick still flashes as new', () => {
    const g = setup({ flashNewRows: true, staleAfter: 1000 });
    g.props.rows = [...g.props.rows, { id: 4, sym: 'DDD', px: 5 }];
    g.api().patchRows([[4, { px: 6 }]]);
    flushSync();
    flushSync();
    expect(g.rowEl('DDD').querySelectorAll('.flash').length).toBe(2);
  });

  it('flashes arrivals in a sorted liveSort view at once', () => {
    const g = setup({ flashNewRows: true, liveSort: 500, sort: [{ key: 'px', dir: 'desc' }] });
    g.props.rows = [...g.props.rows, { id: 4, sym: 'DDD', px: 25 }];
    flushSync();
    flushSync();
    expect(g.order()).toEqual(['AAA', 'DDD', 'BBB', 'CCC']);
    expect(g.rowEl('DDD').querySelector('.flash')).not.toBeNull();
  });

  it('on many rows, a diff and a walk both flash the arrival and not the copies', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ id: i, sym: `S${i}`, px: i }));
    const g = setup({ flashNewRows: true, staleAfter: 1000, rows: many, height: 2000 });
    tick(1300);
    // One row added at the top, one copied: a diff.
    g.props.rows = [{ id: 900, sym: 'NEW', px: 0 }, ...g.props.rows.map((r) => (r.id === 1 ? { ...r, px: 1.5 } : r))];
    flushSync();
    flushSync();
    expect(g.rowEl('NEW').querySelector('.flash')).not.toBeNull();
    expect(g.rowEl('S1').querySelector('.flash')).toBeNull();
    expect(g.rowEl('S1').classList.contains('stale')).toBe(false);
    expect(g.rowEl('S2').classList.contains('stale')).toBe(true);
    tick(1300);
    // 100 rows copied (odd ids) and one new: more than a diff takes, so the
    // rows are walked.
    g.props.rows = [{ id: 901, sym: 'NEW2', px: 0 }, ...g.props.rows.map((r) => ((r.id as number) % 2 ? { ...r } : r))];
    flushSync();
    flushSync();
    expect(g.rowEl('NEW2').querySelector('.flash')).not.toBeNull();
    expect(g.rowEl('S3').querySelector('.flash')).toBeNull();
    expect(g.rowEl('S2').classList.contains('stale')).toBe(true);
    expect(g.rowEl('S3').classList.contains('stale')).toBe(false);
  });

  it('a new getRowId starts the tracking over: nothing flashes', () => {
    const g = setup({ flashNewRows: true, getRowId: (r: GridRow) => r.id as number });
    g.props.getRowId = (r: GridRow) => `k${r.id}`;
    flushSync();
    flushSync();
    expect(document.querySelector('.flash')).toBeNull();
  });

  it('a wholesale replacement does not flash every row', () => {
    const g = setup({ flashNewRows: true });
    g.props.rows = Array.from({ length: 100 }, (_, i) => ({ id: 100 + i, sym: `S${i}`, px: i }));
    flushSync();
    flushSync();
    expect(g.rowEl('S0')).toBeTruthy();
    expect(document.querySelector('.flash')).toBeNull();
  });

  it('turned on later, it does not replay an old change', () => {
    const g = setup({});
    g.props.rows = [...g.props.rows, { id: 4, sym: 'DDD', px: 5 }];
    flushSync();
    g.props.flashNewRows = true;
    flushSync();
    flushSync();
    expect(g.rowEl('DDD').querySelector('.flash')).toBeNull();
  });
});
