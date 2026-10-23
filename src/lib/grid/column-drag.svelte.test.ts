// @vitest-environment jsdom
// Header drag-and-drop reorder. The drop reports positions among the columns
// on screen; the order is kept over every column, hidden and pinned included.
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import type { ColumnDef } from './column';
import { mountGrid, type MountedGrid } from './test-fixtures/mount-grid';

const cols = (...keys: string[]): ColumnDef[] => keys.map((k) => ({ type: 'text', key: k, header: k.toUpperCase() }));
const row = { id: 1, a: 'a', b: 'b', c: 'c', d: 'd' };

let mounted: MountedGrid | null = null;
afterEach(() => {
  mounted?.destroy();
  mounted = null;
});

function mount(props: Record<string, unknown>) {
  const reorders: string[][] = [];
  mounted = mountGrid({ rows: [row], onColumnReorder: (k: string[]) => reorders.push(k), ...props });
  const m = mounted;
  const headers = () => [...m.target.querySelectorAll('[role=columnheader]')] as HTMLElement[];
  const names = () => headers().map((h) => h.textContent?.trim());
  const drag = (from: number, to: number) => {
    headers()[from].dispatchEvent(new Event('dragstart', { bubbles: true }));
    headers()[to].dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    flushSync();
  };
  return { names, drag, reorders };
}

describe('header drag reorder', () => {
  it('moves the dragged column to the drop target', () => {
    const g = mount({ columns: cols('a', 'b', 'c') });
    g.drag(0, 2);
    expect(g.names()).toEqual(['B', 'C', 'A']);
    expect(g.reorders).toEqual([['b', 'c', 'a']]);
  });

  it('moves the column you see when another column is hidden', () => {
    const g = mount({ columns: cols('a', 'b', 'c'), hiddenColumns: ['a'] });
    expect(g.names()).toEqual(['B', 'C']);
    g.drag(0, 1);
    expect(g.names()).toEqual(['C', 'B']);
    expect(g.reorders).toEqual([['a', 'c', 'b']]);
  });

  it('moves the column you see when a column is pinned to the left', () => {
    const columns = cols('a', 'b', 'c', 'd');
    columns[2] = { ...columns[2], pinned: 'left' };
    const g = mount({ columns });
    expect(g.names()).toEqual(['C', 'A', 'B', 'D']);
    g.drag(1, 3); // A onto D
    expect(g.names()).toEqual(['C', 'B', 'D', 'A']);
  });
});
