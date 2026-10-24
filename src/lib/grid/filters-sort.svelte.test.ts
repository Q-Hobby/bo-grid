// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import type { ColumnDef, GridRow, SortState } from './column';
import { createArraySource, type RowSourceParams } from './source';
import { mountGrid, type MountedGrid } from './test-fixtures/mount-grid';

const columns: ColumnDef[] = [
  { type: 'text', key: 'sym', header: 'Sym' },
  { type: 'text', key: 'sector', header: 'Sector' },
  { type: 'number', key: 'px', header: 'Px' },
];
const rows: GridRow[] = [
  { id: 1, sym: 'AAA', sector: 'Bank', px: 10 },
  { id: 2, sym: 'BBB', sector: 'Tech', px: 20 },
];

let m: MountedGrid | null = null;
afterEach(() => {
  m?.destroy();
  m = null;
});
const header = (i: number) => m!.target.querySelectorAll<HTMLElement>('[role=columnheader]')[i];

describe('what the grid hands out is a plain copy', () => {
  it('onSortChange gets sorts that can be cloned (posted to a worker, stored)', () => {
    const seen: SortState[][] = [];
    m = mountGrid({ rows, columns, onSortChange: (s: SortState[]) => seen.push(s) });
    header(0).click();
    flushSync();
    header(1).dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    flushSync();
    expect(seen.length).toBe(2);
    expect(() => structuredClone(seen[1])).not.toThrow();
    expect(seen[1]).toEqual([
      { key: 'sym', dir: 'asc' },
      { key: 'sector', dir: 'asc' },
    ]);
  });

  it('a row source gets request params that can be cloned', async () => {
    const inner = createArraySource(rows);
    const errors: unknown[] = [];
    const source = {
      getRows: (p: RowSourceParams) => {
        try {
          structuredClone(p);
        } catch (e) {
          errors.push(e);
        }
        return inner.getRows(p);
      },
    };
    m = mountGrid({ rows: [], columns, source, height: 200 });
    header(0).click();
    flushSync();
    await Promise.resolve();
    expect(errors).toEqual([]);
  });
});

describe('the filter row and the filter menu', () => {
  it('typing in the filter row replaces a menu filter on that column', () => {
    const onFilterChange = vi.fn();
    m = mountGrid({
      rows,
      columns,
      filterRow: true,
      filterMenu: true,
      columnFilters: { sector: { kind: 'text', op: 'contains', q: 'Bank' } },
      onFilterChange,
    });
    const input = m.target.querySelectorAll<HTMLInputElement>('.fr-input')[1];
    input.value = 'Te';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(onFilterChange).toHaveBeenLastCalledWith({});
  });

  it('takes its placeholder from labels', () => {
    m = mountGrid({ rows, columns, filterRow: true, labels: { filterPlaceholder: 'lọc…' } });
    expect(m.target.querySelector<HTMLInputElement>('.fr-input')!.placeholder).toBe('lọc…');
  });
});
