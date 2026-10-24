// @vitest-environment jsdom
// Hotkeys, and the selection and editor following their rows: on a live list
// a row added above the focused one must not slide another row under the
// focus, a hotkey or an edit's commit.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Grid from './Grid.svelte';
import type { CellEditEvent, ColumnDef, GridRow } from './column';
import type { GridApi } from './api';
import type { HotkeyContext } from './hotkeys';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const columns: ColumnDef[] = [
  { type: 'text', key: 'sym', header: 'Sym', editable: true },
  { type: 'number', key: 'px', header: 'Px', editable: true },
];
const row = (id: number, sym: string, px = id * 10): GridRow => ({ id, sym, px });

interface Live {
  props: { rows: GridRow[]; [key: string]: unknown };
  target: HTMLElement;
  api: () => GridApi;
  grid: () => HTMLElement;
}
let cleanup: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanup) c();
  cleanup = [];
});

function live(extra: Record<string, unknown> = {}): Live {
  let api: GridApi | undefined;
  const props = $state({ columns, rows: [row(1, 'AAA'), row(2, 'BBB'), row(3, 'CCC')], height: 300, onReady: (a: GridApi) => (api = a), ...extra });
  const target = document.createElement('div');
  document.body.append(target);
  const g = mount(Grid, { target, props: props as never });
  flushSync();
  cleanup.push(() => {
    unmount(g);
    target.remove();
  });
  return { props, target, api: () => api!, grid: () => target.querySelector('[role=grid]') as HTMLElement };
}

function press(el: Element, key: string, init: KeyboardEventInit = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  flushSync();
}
/** The focused cell as "r<row>-c<col>". */
const active = (l: Live) => l.grid().getAttribute('aria-activedescendant')?.match(/r\d+-c\d+$/)?.[0] ?? null;
const editor = (l: Live) => l.target.querySelector('input.bo-edit') as HTMLInputElement | null;
/** The row index the open editor sits on. */
const editorRow = (l: Live) => editor(l)?.closest('[id*="-r"]')?.id.match(/-r(\d+)-c\d+$/)?.[1];

describe('hotkeys', () => {
  it('runs a binding with the focused row and column, before the grid’s own keys', () => {
    const seen: HotkeyContext[] = [];
    const l = live({ hotkeys: { b: (ctx: HotkeyContext) => void seen.push(ctx) } });
    l.api().focusCell(2, 'px');
    flushSync();
    press(l.grid(), 'b');
    expect(seen).toHaveLength(1);
    expect(seen[0].row?.id).toBe(2);
    expect(seen[0].column?.key).toBe('px');
    // B did not open the editor (type-to-edit), the binding took it.
    expect(editor(l)).toBeNull();
  });

  it('runs Shift and Mod bindings, and gives a null row without a focus', () => {
    const calls: string[] = [];
    const l = live({
      hotkeys: {
        'Shift+C': ({ row }: HotkeyContext) => void calls.push(`all:${row?.id ?? 'none'}`),
        'Mod+K': () => void calls.push('ticket'),
      },
    });
    press(l.grid(), 'C', { shiftKey: true });
    press(l.grid(), 'k', { ctrlKey: true });
    press(l.grid(), 'k', { metaKey: true });
    expect(calls).toEqual(['all:none', 'ticket', 'ticket']);
  });

  it('runs a held-down key once, and leaves the key to the grid when the binding returns false', () => {
    const b = vi.fn();
    const l = live({ hotkeys: { b, Enter: () => false } });
    l.api().focusCell(1, 'sym');
    flushSync();
    press(l.grid(), 'b');
    press(l.grid(), 'b', { repeat: true });
    press(l.grid(), 'b', { repeat: true });
    expect(b).toHaveBeenCalledTimes(1);
    expect(editor(l)).toBeNull();
    press(l.grid(), 'Enter');
    expect(editor(l)).not.toBeNull();
  });

  it('lets a held key repeat as the grid’s when its binding passed it on', () => {
    const l = live({ hotkeys: { ArrowDown: () => false }, rows: [row(1, 'A'), row(2, 'B'), row(3, 'C'), row(4, 'D')] });
    l.api().focusCell(1, 'sym');
    flushSync();
    press(l.grid(), 'ArrowDown');
    press(l.grid(), 'ArrowDown', { repeat: true });
    press(l.grid(), 'ArrowDown', { repeat: true });
    expect(active(l)).toBe('r3-c0');
  });

  it('leaves keys to an open editor', () => {
    const b = vi.fn();
    const l = live({ hotkeys: { b }, onCellEdit: () => {} });
    l.api().focusCell(1, 'sym');
    flushSync();
    press(l.grid(), 'Enter');
    press(editor(l)!, 'b');
    press(l.grid(), 'b'); // even if one reached the grid while editing
    expect(b).not.toHaveBeenCalled();
  });

  it('throws on a binding it cannot read', () => {
    expect(() => live({ hotkeys: { 'Ctl+B': () => {} } })).toThrow(/Ctl/);
  });
});

describe('the selection follows its rows', () => {
  it('keeps the focus on its row when rows arrive above it', () => {
    const b = vi.fn();
    const l = live({ hotkeys: { b: ({ row }: HotkeyContext) => b(row?.id) } });
    l.api().focusCell(2, 'px'); // BBB, index 1
    flushSync();
    expect(active(l)).toBe('r1-c1');
    l.props.rows = [row(5, 'NEW'), row(4, 'NEW2'), ...l.props.rows];
    flushSync();
    expect(active(l)).toBe('r3-c1');
    expect(l.api().getFocusedCell()?.row.id).toBe(2);
    press(l.grid(), 'b');
    expect(b).toHaveBeenCalledWith(2);
  });

  it('moves a range with its rows, and clears the selection when the focused row leaves', () => {
    const l = live();
    l.api().focusCell(1, 'sym');
    flushSync();
    press(l.grid(), 'ArrowDown', { shiftKey: true }); // AAA..BBB selected, focus on BBB
    l.props.rows = [row(9, 'TOP'), ...l.props.rows];
    flushSync();
    expect(active(l)).toBe('r2-c0');
    expect(l.target.querySelectorAll('.c.sel').length).toBe(2);
    l.props.rows = l.props.rows.filter((r) => r.id !== 2);
    flushSync();
    expect(active(l)).toBeNull();
    expect(l.api().getFocusedCell()).toBeNull();
  });

  it('follows a row replaced by a new object with the same id', () => {
    const l = live();
    l.api().focusCell(3, 'px');
    flushSync();
    l.props.rows = [row(3, 'CCC', 99), row(1, 'AAA'), row(2, 'BBB')];
    flushSync();
    expect(active(l)).toBe('r0-c1');
  });
});

describe('an open editor follows its row', () => {
  it('moves with its row when rows arrive above it, keeping what was typed, and writes to that row', () => {
    const edits: CellEditEvent[] = [];
    const l = live({ onCellEdit: (e: CellEditEvent) => edits.push(e) });
    l.api().focusCell(2, 'px');
    flushSync();
    press(l.grid(), 'Enter');
    const input = editor(l)!;
    input.focus();
    input.value = '25';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // Chrome blurs an input as it is removed; do the same here, so the move
    // is tested against it.
    const remove = Element.prototype.remove;
    Element.prototype.remove = function (this: Element) {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && this.contains(focused)) focused.dispatchEvent(new FocusEvent('blur'));
      remove.call(this);
    };
    try {
      l.props.rows = [row(7, 'NEW'), ...l.props.rows];
      flushSync();
    } finally {
      Element.prototype.remove = remove;
    }
    expect(edits).toHaveLength(0);
    expect(editorRow(l)).toBe('2');
    expect(editor(l)!.value).toBe('25');
    editor(l)!.value = '26';
    press(editor(l)!, 'Enter');
    editor(l)?.dispatchEvent(new FocusEvent('blur'));
    flushSync();
    expect(edits.map((e) => [e.row.id, e.value])).toEqual([[2, 26]]);
  });

  it('closes unwritten when its row leaves', () => {
    const edits: CellEditEvent[] = [];
    const l = live({ onCellEdit: (e: CellEditEvent) => edits.push(e) });
    l.api().focusCell(2, 'sym');
    flushSync();
    press(l.grid(), 'Enter');
    editor(l)!.value = 'gone';
    l.props.rows = l.props.rows.filter((r) => r.id !== 2);
    flushSync();
    expect(editor(l)).toBeNull();
    expect(edits).toHaveLength(0);
  });

  it('drops a late commit from an old editor while another edit is open in its column', () => {
    const edits: CellEditEvent[] = [];
    const l = live({ onCellEdit: (e: CellEditEvent) => edits.push(e) });
    l.api().focusCell(1, 'sym');
    flushSync();
    press(l.grid(), 'Enter');
    const old = editor(l)!;
    old.value = 'OLD';
    press(old, 'Escape');
    l.api().focusCell(2, 'sym');
    flushSync();
    press(l.grid(), 'Enter');
    old.dispatchEvent(new FocusEvent('blur')); // the first editor, long gone
    flushSync();
    expect(edits).toHaveLength(0);
    expect(editor(l)).not.toBeNull();
  });

  it('drops a commit from an editor that has already closed', () => {
    const edits: CellEditEvent[] = [];
    const l = live({ onCellEdit: (e: CellEditEvent) => edits.push(e) });
    l.api().focusCell(1, 'sym');
    flushSync();
    press(l.grid(), 'Enter');
    const input = editor(l)!;
    input.value = 'XYZ';
    press(input, 'Escape'); // cancels
    input.dispatchEvent(new FocusEvent('blur')); // a late blur from the closed editor
    flushSync();
    expect(edits).toHaveLength(0);
  });
});
