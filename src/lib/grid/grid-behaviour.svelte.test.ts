// @vitest-environment jsdom
// Characterisation tests for grid behaviour that lives in Grid.svelte's script:
// keyboard navigation, editing with undo and redo, copy, paste, the fill
// handle, saved layouts, lazy tree loading, row selection and menus. They pin
// the behaviour as it is, so moving that code into modules cannot change it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import type { CellEditEvent, ColumnDef, GridRow } from './column';
import { mountGrid, type MountedGrid } from './test-fixtures/mount-grid';

const columns: ColumnDef[] = [
  { type: 'text', key: 'sym', header: 'Sym', editable: true },
  { type: 'number', key: 'px', header: 'Px', editable: true },
];
const threeRows = (): GridRow[] => [
  { id: 1, sym: 'AAA', px: 10 },
  { id: 2, sym: 'BBB', px: 20 },
  { id: 3, sym: 'CCC', px: 30 },
];

let mounted: MountedGrid[] = [];
function mountTracked(props: Record<string, unknown>): MountedGrid {
  const m = mountGrid(props);
  mounted.push(m);
  return m;
}
afterEach(() => {
  for (const m of mounted) m.destroy();
  mounted = [];
  localStorage.clear();
  vi.unstubAllGlobals();
});

const gridEl = (m: MountedGrid) => m.target.querySelector('[role=grid], [role=treegrid]') as HTMLElement;
/** The focused cell as "r<row>-c<col>", or null. */
function active(m: MountedGrid): string | null {
  const id = gridEl(m).getAttribute('aria-activedescendant');
  return id ? (id.match(/r\d+-c\d+$/)?.[0] ?? null) : null;
}
function press(el: Element, key: string, mods: KeyboardEventInit = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }));
  flushSync();
}
const cellAt = (m: MountedGrid, r: number, c: number) =>
  m.target.querySelector(`[id$="-r${r}-c${c}"]`) as HTMLElement;
const settle = async () => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0));
  flushSync();
};

describe('keyboard navigation', () => {
  it('arrows move the focus; Home/End stay in the row, with Ctrl/⌘ they span the grid', () => {
    const m = mountTracked({ columns, rows: threeRows() });
    m.api().focusCell(1, 'sym');
    flushSync();
    expect(active(m)).toBe('r0-c0');
    press(gridEl(m), 'ArrowDown');
    expect(active(m)).toBe('r1-c0');
    press(gridEl(m), 'ArrowRight');
    expect(active(m)).toBe('r1-c1');
    press(gridEl(m), 'Home');
    expect(active(m)).toBe('r1-c0');
    press(gridEl(m), 'End', { ctrlKey: true });
    expect(active(m)).toBe('r2-c1');
    press(gridEl(m), 'Home', { ctrlKey: true });
    expect(active(m)).toBe('r0-c0');
  });

  it('getFocusedCell reports the focused row and column as the focus moves', () => {
    const m = mountTracked({ columns, rows: threeRows() });
    expect(m.api().getFocusedCell()).toBeNull();
    m.api().focusCell(1, 'sym');
    flushSync();
    press(gridEl(m), 'ArrowDown');
    press(gridEl(m), 'ArrowRight');
    const f = m.api().getFocusedCell();
    expect(f?.row.id).toBe(2);
    expect(f?.column.key).toBe('px');
    press(gridEl(m), 'Escape');
    expect(m.api().getFocusedCell()).toBeNull();
  });

  it('PageDown moves by a page, clamped to the last row; Escape clears the focus', () => {
    const m = mountTracked({ columns, rows: threeRows() });
    m.api().focusCell(1, 'px');
    flushSync();
    press(gridEl(m), 'PageDown');
    expect(active(m)).toBe('r2-c1');
    press(gridEl(m), 'Escape');
    expect(active(m)).toBeNull();
  });
});

describe('editing, undo and redo', () => {
  function editable() {
    const edits: CellEditEvent[] = [];
    const m = mountTracked({ columns, rows: threeRows(), onCellEdit: (e: CellEditEvent) => edits.push(e) });
    return { m, edits };
  }
  const editor = (m: MountedGrid) => m.target.querySelector('input.bo-edit') as HTMLInputElement | null;

  it('Enter opens the editor; Enter in it commits through onCellEdit', () => {
    const { m, edits } = editable();
    m.api().focusCell(2, 'sym');
    flushSync();
    press(gridEl(m), 'Enter');
    const input = editor(m)!;
    expect(input.value).toBe('BBB');
    input.value = 'BBX';
    press(input, 'Enter');
    expect(edits).toHaveLength(1);
    expect(edits[0].row.id).toBe(2);
    expect(edits[0].column.key).toBe('sym');
    expect(edits[0].value).toBe('BBX');
    expect(editor(m)).toBeNull();
  });

  it('Escape in the editor cancels without an edit', () => {
    const { m, edits } = editable();
    m.api().focusCell(1, 'sym');
    flushSync();
    press(gridEl(m), 'Enter');
    editor(m)!.value = 'nope';
    press(editor(m)!, 'Escape');
    expect(edits).toHaveLength(0);
    expect(editor(m)).toBeNull();
  });

  it('typing a character opens the editor seeded with it', () => {
    const { m } = editable();
    m.api().focusCell(1, 'sym');
    flushSync();
    press(gridEl(m), 'q');
    expect(editor(m)?.value).toBe('q');
  });

  it('Ctrl+Z re-emits the old value, Ctrl+Y the new one again', () => {
    const { m, edits } = editable();
    m.api().focusCell(1, 'px');
    flushSync();
    press(gridEl(m), 'Enter');
    editor(m)!.value = '11';
    press(editor(m)!, 'Enter');
    expect(edits.map((e) => e.value)).toEqual([11]);
    press(gridEl(m), 'z', { ctrlKey: true });
    expect(edits.map((e) => e.value)).toEqual([11, 10]);
    press(gridEl(m), 'y', { ctrlKey: true });
    expect(edits.map((e) => e.value)).toEqual([11, 10, 11]);
    // Nothing left to redo: a further Ctrl+Y emits nothing.
    press(gridEl(m), 'y', { ctrlKey: true });
    expect(edits).toHaveLength(3);
  });
});

describe('copy and paste', () => {
  it('Ctrl+A then Ctrl+C copies the formatted cells as tab-separated lines', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const m = mountTracked({ columns, rows: threeRows() });
    m.api().focusCell(1, 'sym');
    flushSync();
    press(gridEl(m), 'a', { ctrlKey: true });
    press(gridEl(m), 'c', { ctrlKey: true });
    await settle();
    expect(writeText).toHaveBeenCalledWith('AAA\t10.00\nBBB\t20.00\nCCC\t30.00');
  });

  it('pastes a block from the focused cell as one undo step', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: vi.fn().mockResolvedValue('XX\t1\nYY\t2') } });
    const edits: CellEditEvent[] = [];
    const m = mountTracked({ columns, rows: threeRows(), onCellEdit: (e: CellEditEvent) => edits.push(e) });
    m.api().focusCell(2, 'sym');
    flushSync();
    press(gridEl(m), 'v', { ctrlKey: true });
    await settle();
    expect(edits.map((e) => [e.row.id, e.column.key, e.value])).toEqual([
      [2, 'sym', 'XX'],
      [2, 'px', 1],
      [3, 'sym', 'YY'],
      [3, 'px', 2],
    ]);
    press(gridEl(m), 'z', { ctrlKey: true });
    expect(edits.slice(4).map((e) => [e.row.id, e.column.key, e.value])).toEqual([
      [2, 'sym', 'BBB'],
      [2, 'px', 20],
      [3, 'sym', 'CCC'],
      [3, 'px', 30],
    ]);
  });

  it('a single value fills the whole selection', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText: vi.fn().mockResolvedValue('7') } });
    const edits: CellEditEvent[] = [];
    const m = mountTracked({ columns, rows: threeRows(), onCellEdit: (e: CellEditEvent) => edits.push(e) });
    m.api().focusCell(1, 'px');
    flushSync();
    press(gridEl(m), 'ArrowDown', { shiftKey: true });
    press(gridEl(m), 'v', { ctrlKey: true });
    await settle();
    expect(edits.map((e) => [e.row.id, e.value])).toEqual([
      [1, 7],
      [2, 7],
    ]);
  });
});

describe('fill handle', () => {
  it('dragging the corner down copies the value into the cells it covers', () => {
    const edits: CellEditEvent[] = [];
    const m = mountTracked({ columns, rows: threeRows(), fillHandle: true, onCellEdit: (e: CellEditEvent) => edits.push(e) });
    m.api().focusCell(1, 'px');
    flushSync();
    const handle = m.target.querySelector('.fill-handle') as HTMLElement;
    handle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    flushSync();
    cellAt(m, 2, 1).dispatchEvent(new MouseEvent('pointerenter'));
    flushSync();
    window.dispatchEvent(new MouseEvent('pointerup'));
    flushSync();
    expect(edits.map((e) => [e.row.id, e.column.key, e.value])).toEqual([
      [2, 'px', 10],
      [3, 'px', 10],
    ]);
  });
});

describe('saved layouts (persistKey)', () => {
  it('order, widths, hidden and pinned columns, and pinned rows come back on remount', () => {
    const cols: ColumnDef[] = [...columns, { type: 'number', key: 'vol', header: 'Vol' }];
    const rows = threeRows().map((r) => ({ ...r, vol: 1 }));
    const first = mountTracked({ columns: cols, rows, persistKey: 'layout', rowPinning: true });
    expect(
      first.api().applyState({
        version: 1,
        order: ['px', 'sym', 'vol'],
        widths: { px: 120 },
        hidden: ['vol'],
        pinned: { sym: 'left' },
        sorts: [],
        filters: {},
      }),
    ).toBe(true);
    first.api().pinRow(3);
    flushSync();
    const saved = first.api().getState();
    first.destroy();
    mounted = mounted.filter((m) => m !== first);

    const second = mountTracked({ columns: cols, rows, persistKey: 'layout', rowPinning: true });
    const back = second.api().getState();
    expect(back.order).toEqual(saved.order);
    expect(back.widths).toEqual({ px: 120 });
    expect(back.hidden).toEqual(['vol']);
    expect(back.pinned).toEqual({ sym: 'left' });
    expect(second.api().getPinnedRowIds()).toEqual([3]);
  });

  it('a corrupt saved value is ignored', () => {
    localStorage.setItem('bo-grid:widths:bad', '{not json');
    localStorage.setItem('bo-grid:hidden:bad', '"px"');
    const m = mountTracked({ columns, rows: threeRows(), persistKey: 'bad' });
    expect(m.api().getState().widths).toEqual({});
    expect(m.api().getState().hidden).toEqual([]);
  });
});

describe('lazy tree children', () => {
  const treeRows = (): GridRow[] => [{ id: 100, sym: 'Parent', px: 1 }];
  const kids = [{ id: 101, sym: 'Kid', px: 2 }];
  const rowCount = (m: MountedGrid) => m.target.querySelectorAll('.spacer > .row').length;

  it('ArrowRight loads and shows the children once; ArrowLeft collapses', async () => {
    const loadChildren = vi.fn().mockResolvedValue(kids);
    const m = mountTracked({ columns, rows: treeRows(), loadChildren, hasChildren: () => true });
    m.api().focusCell(100, 'sym');
    flushSync();
    press(gridEl(m), 'ArrowRight');
    await settle();
    expect(loadChildren).toHaveBeenCalledTimes(1);
    expect(rowCount(m)).toBe(2);
    press(gridEl(m), 'ArrowLeft');
    expect(rowCount(m)).toBe(1);
    press(gridEl(m), 'ArrowRight');
    await settle();
    expect(loadChildren).toHaveBeenCalledTimes(1); // cached
    expect(rowCount(m)).toBe(2);
  });

  it('a failed load collapses the node again', async () => {
    const loadChildren = vi.fn().mockRejectedValue(new Error('offline'));
    const m = mountTracked({ columns, rows: treeRows(), loadChildren, hasChildren: () => true });
    m.api().focusCell(100, 'sym');
    flushSync();
    press(gridEl(m), 'ArrowRight');
    await settle();
    const row = m.target.querySelector('.spacer > .row') as HTMLElement;
    expect(row.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('row selection and menus', () => {
  it('Space toggles the focused row and reports the selection', () => {
    const changes: (string | number)[][] = [];
    const m = mountTracked({ columns, rows: threeRows(), rowSelection: true, onRowSelectionChange: (ids: (string | number)[]) => changes.push(ids) });
    m.api().focusCell(2, 'sym');
    flushSync();
    press(gridEl(m), ' ');
    press(gridEl(m), 'ArrowDown');
    press(gridEl(m), ' ');
    expect(changes).toEqual([[2], [2, 3]]);
    expect(m.api().getSelectedRows().map((r) => r.id)).toEqual([2, 3]);
  });

  it('the row menu opens on right-click and closes on Escape or a click outside', () => {
    const picked: string[] = [];
    const m = mountTracked({
      columns,
      rows: threeRows(),
      rowMenu: (row: GridRow) => [{ label: `Buy ${row.sym}`, onSelect: () => picked.push(String(row.sym)) }],
    });
    const menu = () => document.querySelector('[role=menu]');
    const row = m.target.querySelector('.spacer > .row') as HTMLElement;
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
    flushSync();
    expect(menu()?.textContent).toContain('Buy AAA');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    flushSync();
    expect(menu()).toBeNull();
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    flushSync();
    expect(menu()).not.toBeNull();
    window.dispatchEvent(new MouseEvent('pointerdown'));
    flushSync();
    expect(menu()).toBeNull();
  });
});
