// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import type { ColumnDef, GridRow } from './column';
import { mountGrid, type MountedGrid } from './test-fixtures/mount-grid';

// Rows keyed by a string `id`, with no `getRowId`. The typed literal guards the
// type: if `GridRow.id` goes back to numbers only, `pnpm check` fails here
// (vitest itself does not type-check).
const rows = (): GridRow[] => [
  { id: 'AAA', sym: 'AAA', px: 10 },
  { id: 'BBB', sym: 'BBB', px: 20 },
];
const columns: ColumnDef[] = [
  { type: 'text', key: 'sym', header: 'Sym' },
  { type: 'number', key: 'px', header: 'Px' },
];

let grid: MountedGrid | null = null;
afterEach(() => {
  grid?.destroy();
  grid = null;
});

const press = (el: Element, key: string) => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  flushSync();
};
const rowText = (m: MountedGrid) => [...m.target.querySelectorAll('.viewport .row')].map((r) => r.textContent?.replace(/\s+/g, ' ').trim());

describe('string row ids', () => {
  it('patchRows finds a row by its string id', () => {
    grid = mountGrid({ rows: rows(), columns });
    expect(grid.api().patchRows([['BBB', { px: 21 }]])).toBe(1);
    flushSync();
    expect(rowText(grid)).toEqual(['AAA 10.00', 'BBB 21.00']);
  });

  it('selection reports string ids', () => {
    const changes: (string | number)[][] = [];
    grid = mountGrid({ rows: rows(), columns, rowSelection: true, onRowSelectionChange: (ids: (string | number)[]) => changes.push(ids) });
    expect(grid.api().focusCell('BBB', 'sym')).toBe(true);
    flushSync();
    press(grid.target.querySelector('[role=grid]')!, ' ');
    expect(changes).toEqual([['BBB']]);
    expect(grid.api().getSelectedRows().map((r) => r.id)).toEqual(['BBB']);
  });

  it('pinRow and getPinnedRowIds take string ids', () => {
    grid = mountGrid({ rows: rows(), columns });
    expect(grid.api().pinRow('BBB')).toBe(true);
    flushSync();
    expect(grid.api().getPinnedRowIds()).toEqual(['BBB']);
  });
});
