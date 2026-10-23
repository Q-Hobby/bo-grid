// @vitest-environment jsdom
// `liveSort`: rows patched in place re-sort and re-filter on a throttle.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import type { ColumnDef, GridRow } from './column';
import { mountGrid, type MountedGrid } from './test-fixtures/mount-grid';

const columns: ColumnDef[] = [
  { type: 'text', key: 'sym', header: 'Sym', editable: true },
  { type: 'number', key: 'px', header: 'Px' },
  { type: 'number', key: 'vol', header: 'Vol' },
];
const rows = (): GridRow[] => [
  { id: 1, sym: 'AAA', px: 30, vol: 1 },
  { id: 2, sym: 'BBB', px: 20, vol: 1 },
  { id: 3, sym: 'CCC', px: 10, vol: 1 },
];
const byPxDesc = [{ key: 'px', dir: 'desc' as const }];

let m: MountedGrid | null = null;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  m?.destroy();
  m = null;
  vi.useRealTimers();
});

const order = (g: { target: HTMLElement }) =>
  [...g.target.querySelectorAll('.spacer > .row')]
    .sort((a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')))
    .map((r) => {
      const cell = r.querySelector('[aria-colindex="1"]');
      return cell?.querySelector('input')?.value ?? cell?.textContent?.trim(); // an open editor holds the text
    });
const tick = (ms: number) => {
  vi.advanceTimersByTime(ms);
  flushSync();
};

describe('liveSort', () => {
  it('off: patched rows keep their place until refresh()', () => {
    m = mountGrid({ columns, rows: rows(), sort: byPxDesc });
    m.api().patchRows([[3, { px: 99 }]]);
    tick(1000);
    expect(order(m)).toEqual(['AAA', 'BBB', 'CCC']);
    m.api().refresh();
    flushSync();
    expect(order(m)).toEqual(['CCC', 'AAA', 'BBB']);
  });

  it('re-sorts once the throttle passes', () => {
    m = mountGrid({ columns, rows: rows(), sort: byPxDesc, liveSort: 200 });
    m.api().patchRows([[3, { px: 99 }]]);
    tick(100);
    expect(order(m)).toEqual(['AAA', 'BBB', 'CCC']);
    tick(100);
    expect(order(m)).toEqual(['CCC', 'AAA', 'BBB']);
  });

  it('true waits 500 ms', () => {
    m = mountGrid({ columns, rows: rows(), sort: byPxDesc, liveSort: true });
    m.api().patchRows([[3, { px: 99 }]]);
    tick(499);
    expect(order(m)[0]).toBe('AAA');
    tick(1);
    expect(order(m)[0]).toBe('CCC');
  });

  it('re-filters: a row that stops matching leaves, one that starts matching joins', () => {
    m = mountGrid({
      columns,
      rows: rows(),
      sort: byPxDesc,
      columnFilters: { px: { kind: 'number', op: 'gt', a: 15 } },
      liveSort: 100,
    });
    expect(order(m)).toEqual(['AAA', 'BBB']);
    m.api().patchRows([
      [2, { px: 5 }],
      [3, { px: 25 }],
    ]);
    tick(100);
    expect(order(m)).toEqual(['AAA', 'CCC']);
  });

  it('a field the grid neither sorts nor filters by moves nothing', () => {
    m = mountGrid({ columns, rows: rows(), sort: byPxDesc, liveSort: 100 });
    m.api().patchRows([[3, { vol: 5 }]]);
    tick(100);
    expect(order(m)).toEqual(['AAA', 'BBB', 'CCC']);
  });

  it('keeps the focus on the same row as it moves', () => {
    m = mountGrid({ columns, rows: rows(), sort: byPxDesc, liveSort: 100 });
    m.api().focusCell(2, 'px'); // BBB, second row
    flushSync();
    const grid = m.target.querySelector('[role=grid]') as HTMLElement;
    expect(grid.getAttribute('aria-activedescendant')).toMatch(/-r1-c1$/);
    m.api().patchRows([[2, { px: 50 }]]);
    tick(100);
    expect(order(m)).toEqual(['BBB', 'AAA', 'CCC']);
    expect(grid.getAttribute('aria-activedescendant')).toMatch(/-r0-c1$/);
  });

  it('waits while a cell is being edited', () => {
    m = mountGrid({ columns, rows: rows(), sort: byPxDesc, liveSort: 100, onCellEdit: () => {} });
    m.api().focusCell(1, 'sym');
    flushSync();
    const grid = m.target.querySelector('[role=grid]') as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    flushSync();
    m.api().patchRows([[3, { px: 99 }]]);
    tick(300);
    expect(order(m)).toEqual(['AAA', 'BBB', 'CCC']);
    const input = m.target.querySelector('input.bo-edit') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    flushSync();
    tick(100);
    expect(order(m)).toEqual(['CCC', 'AAA', 'BBB']);
  });
});

describe('liveSort, edge cases', () => {
  it('turning it on re-sorts first, so changes made while it was off are not lost', async () => {
    const { mount, unmount } = await import('svelte');
    const Grid = (await import('./Grid.svelte')).default;
    const target = document.createElement('div');
    document.body.append(target);
    let api: import('./api').GridApi | undefined;
    const props = $state({
      columns,
      rows: rows(),
      height: 200,
      sort: byPxDesc,
      liveSort: false as boolean | number,
      onReady: (a: import('./api').GridApi) => (api = a),
    });
    const grid = mount(Grid, { target, props });
    flushSync();
    const g = { target };
    api!.patchRows([[3, { px: 99 }]]); // CCC to the top, unnoticed while off
    tick(1000);
    expect(order(g)).toEqual(['AAA', 'BBB', 'CCC']);
    props.liveSort = 100;
    flushSync();
    expect(order(g)).toEqual(['CCC', 'AAA', 'BBB']);
    api!.patchRows([[2, { px: 50 }]]);
    tick(100);
    expect(order(g)).toEqual(['CCC', 'BBB', 'AAA']);
    unmount(grid);
    target.remove();
  });

  it('leaves a focused group header alone, and regroups a row whose group changed', () => {
    const grouped = rows().map((r, i) => ({ ...r, sector: i < 2 ? 'Bank' : 'Tech' }));
    m = mountGrid({ columns, rows: grouped, sort: byPxDesc, groupBy: ['sector'], liveSort: 100 });
    const grid = m.target.querySelector('[role=grid]') as HTMLElement;
    m.api().focusCell(1, 'px');
    flushSync();
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    flushSync();
    const header = grid.getAttribute('aria-activedescendant');
    m.api().patchRows([[2, { px: 40 }]]);
    tick(100);
    expect(grid.getAttribute('aria-activedescendant')).toBe(header);
    // Data rows by aria-rowindex, after BBB rose to 40: Bank header 2, BBB 3,
    // AAA 4; Tech header 5, CCC 6.
    const rowIndexOf = (sym: string) =>
      [...m!.target.querySelectorAll('.spacer > .row')]
        .find((r) => r.querySelector('[aria-colindex="1"]')?.textContent?.trim() === sym)
        ?.getAttribute('aria-rowindex');
    expect(rowIndexOf('BBB')).toBe('3');
    m.api().patchRows([[2, { sector: 'Tech' }]]);
    tick(100);
    // BBB joins Tech: AAA 3, Tech header 4, BBB 5, CCC 6.
    expect([rowIndexOf('AAA'), rowIndexOf('BBB'), rowIndexOf('CCC')]).toEqual(['3', '5', '6']);
  });

  it('a patch after unmount starts no timer', () => {
    m = mountGrid({ columns, rows: rows(), sort: byPxDesc, liveSort: 100 });
    const api = m.api();
    m.destroy();
    m = null;
    api.patchRows([[3, { px: 99 }]]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
