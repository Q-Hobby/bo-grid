// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushSync } from 'svelte';
import type { ColumnDef, GridRow } from './column';
import { createArraySource, type RowSourceParams } from './source';
import { mountGrid, type MountedGrid } from './test-fixtures/mount-grid';

const columns: ColumnDef[] = [{ type: 'text', key: 'name', header: 'Name' }];
const rows: GridRow[] = [
  { id: 1, name: 'apple' },
  { id: 2, name: 'banana' },
];

let grid: MountedGrid | null = null;
afterEach(() => {
  grid?.destroy();
  grid = null;
});

function type(text: string): void {
  const input = grid!.target.querySelector('.bo-quickfilter') as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

describe('quick filter box', () => {
  it('sends its text to a row source as quickFilter', async () => {
    const calls: RowSourceParams[] = [];
    const inner = createArraySource(rows, { filterKeys: ['name'] });
    const source = { getRows: (p: RowSourceParams) => (calls.push(p), inner.getRows(p)) };
    grid = mountGrid({ rows: [], columns, source, quickFilter: true, height: 200 });
    flushSync();
    type('ban');
    await vi.waitFor(() => expect(calls.at(-1)?.quickFilter).toBe('ban'));
    expect(calls.at(-1)?.filter).toBe('');
    // The source's answer is what the grid shows.
    await vi.waitFor(() => {
      flushSync();
      const text = grid!.target.querySelector('.viewport')?.textContent ?? '';
      expect(text).toContain('banana');
      expect(text).not.toContain('apple');
    });
  });

  it('takes its placeholder from labels', () => {
    grid = mountGrid({ rows, columns, quickFilter: true });
    expect((grid.target.querySelector('.bo-quickfilter') as HTMLInputElement).placeholder).toBe('Search…');
    grid.destroy();
    grid = mountGrid({ rows, columns, quickFilter: true, labels: { quickFilterPlaceholder: 'Tìm…' } });
    expect((grid.target.querySelector('.bo-quickfilter') as HTMLInputElement).placeholder).toBe('Tìm…');
  });
});
