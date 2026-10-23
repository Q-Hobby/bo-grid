// @vitest-environment jsdom
// The footer and data-bar ranges follow api.patchRows through running totals.
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import type { ColumnDef, GridRow } from './column';
import { mountGrid, type MountedGrid } from './test-fixtures/mount-grid';

const columns: ColumnDef[] = [
  { type: 'text', key: 'sym', header: 'Sym' },
  { type: 'number', key: 'qty', header: 'Qty', decimals: 0, groupAgg: 'sum', dataBar: {} },
  { type: 'number', key: 'px', header: 'Px', decimals: 0, groupAgg: 'max' },
  { type: 'number', key: 'notional', header: 'Notional', decimals: 0, groupAgg: 'sum', value: (r) => (r.px as number) * (r.qty as number) },
];
const rows = (): GridRow[] => [
  { id: 1, sym: 'AAA', qty: 10, px: 5 },
  { id: 2, sym: 'BBB', qty: 20, px: 7 },
  { id: 3, sym: 'CCC', qty: 40, px: 3 },
];

let m: MountedGrid | null = null;
afterEach(() => {
  m?.destroy();
  m = null;
});

const footer = (g: { target: HTMLElement }) => [...g.target.querySelectorAll('.footer [role=gridcell], .footer > *')].map((c) => c.textContent?.trim()).filter((t) => t);
const barScale = (g: MountedGrid, sym: string) => {
  const row = [...g.target.querySelectorAll('.spacer > .row')].find((r) => r.textContent?.includes(sym))!;
  const t = (row.querySelector('.bo-databar') as HTMLElement).style.transform.replace(/\s/g, '');
  return Number(t.match(/scaleX\(([^)]+)\)/)?.[1]);
};

describe('running totals', () => {
  it('the footer follows patches, a computed column included', () => {
    m = mountGrid({ columns, rows: rows(), footer: true });
    expect(footer(m)).toEqual(expect.arrayContaining(['70', '7', '310']));
    m.api().patchRows([
      [1, { qty: 15 }],
      [2, { px: 9 }],
      [1, { px: 6 }], // the same row twice in one batch
    ]);
    flushSync();
    // qty 15+20+40 = 75; max px 9; notional 6*15 + 9*20 + 3*40 = 390
    expect(footer(m)).toEqual(expect.arrayContaining(['75', '9', '390']));
  });

  it('a data bar rescales when the largest value moves down', () => {
    m = mountGrid({ columns, rows: rows() });
    expect(barScale(m, 'CCC')).toBe(1);
    m.api().patchRows([[3, { qty: 5 }]]); // the max goes from 40 to 20
    flushSync();
    expect(barScale(m, 'BBB')).toBe(1);
  });
});

describe('running totals: other ways values change', () => {
  it('$state rows edited in place (as onCellEdit does) update the footer', async () => {
    const { mount, unmount } = await import('svelte');
    const Grid = (await import('./Grid.svelte')).default;
    const target = document.createElement('div');
    document.body.append(target);
    const data = $state(rows());
    const grid = mount(Grid, { target, props: { columns, rows: data, height: 200, footer: true } });
    flushSync();
    const g = { target };
    expect(footer(g)).toEqual(expect.arrayContaining(['70']));
    data[0].qty = 100;
    flushSync();
    expect(footer(g)).toEqual(expect.arrayContaining(['160']));
    data[1].qty = 120;
    flushSync();
    expect(footer(g)).toEqual(expect.arrayContaining(['260']));
    unmount(grid);
    target.remove();
  });

  it('a computed column that reads reactive state updates the footer', async () => {
    const { mount, unmount } = await import('svelte');
    const Grid = (await import('./Grid.svelte')).default;
    const target = document.createElement('div');
    document.body.append(target);
    const fx = $state({ rate: 1 });
    const cols: ColumnDef[] = [
      { type: 'text', key: 'sym', header: 'Sym' },
      { type: 'number', key: 'usd', header: 'USD', decimals: 0, groupAgg: 'sum', value: (r) => (r.qty as number) * fx.rate },
    ];
    const grid = mount(Grid, { target, props: { columns: cols, rows: rows(), height: 200, footer: true } });
    flushSync();
    const g = { target };
    expect(footer(g)).toEqual(expect.arrayContaining(['70']));
    fx.rate = 2;
    flushSync();
    expect(footer(g)).toEqual(expect.arrayContaining(['140']));
    unmount(grid);
    target.remove();
  });

  it('a patch that throws midway leaves the totals right', () => {
    m = mountGrid({ columns, rows: rows(), footer: true });
    expect(() => m!.api().patchRows([[1, { qty: 15 }], null as unknown as [number, Record<string, unknown>]])).toThrow();
    m.api().patchRows([[2, { qty: 21 }]]);
    flushSync();
    // Row 1 may or may not have been written before the throw: the totals must match the data either way.
    const r1 = m.rows[0].qty as number;
    expect(footer(m)).toEqual(expect.arrayContaining([String(r1 + 21 + 40)]));
  });
});
