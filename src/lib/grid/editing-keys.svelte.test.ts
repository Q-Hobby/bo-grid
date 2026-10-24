// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import type { CellEditEvent, ColumnDef, GridRow } from './column';
import { mountGrid, type MountedGrid } from './test-fixtures/mount-grid';

// The keyboard keeps working through an edit: a key that ends it (Enter,
// Tab, Escape) gives the focus back to the grid, Tab moves on, and what the
// user types is theirs until they commit.
const columns: ColumnDef[] = [
  { type: 'text', key: 'sym', header: 'Sym', editable: true },
  { type: 'number', key: 'px', header: 'Px', editable: true },
  { type: 'text', key: 'side', header: 'Side', editable: true, options: ['Buy', 'Sell'] },
];
const rows = (): GridRow[] => [
  { id: 1, sym: 'AAA', px: 10, side: 'Buy' },
  { id: 2, sym: 'BBB', px: 20, side: 'Sell' },
];

let m: MountedGrid | null = null;
let edits: CellEditEvent[] = [];
afterEach(() => {
  m?.destroy();
  m = null;
  edits = [];
});

function mount(): MountedGrid {
  m = mountGrid({ columns, rows: rows(), onCellEdit: (e: CellEditEvent) => edits.push(e) });
  return m;
}
const gridEl = () => m!.target.querySelector('[role=grid]') as HTMLElement;
const editor = () => m!.target.querySelector('.bo-edit') as HTMLInputElement | HTMLSelectElement | null;
const active = () => gridEl().getAttribute('aria-activedescendant')?.match(/r\d+-c\d+$/)?.[0] ?? null;
function press(el: Element, key: string, mods: KeyboardEventInit = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }));
  flushSync();
}
function openOn(id: number, key: string): void {
  m!.api().focusCell(id, key);
  flushSync();
  press(gridEl(), 'Enter');
}

describe('keys that end an edit', () => {
  it('Enter commits and the grid keeps the keyboard', () => {
    mount();
    openOn(1, 'sym');
    (editor() as HTMLInputElement).value = 'AAX';
    press(editor()!, 'Enter');
    expect(edits.map((e) => e.value)).toEqual(['AAX']);
    expect(document.activeElement).toBe(gridEl());
    press(gridEl(), 'ArrowDown');
    expect(active()).toBe('r1-c0');
  });

  it('Escape cancels and the grid keeps the keyboard', () => {
    mount();
    openOn(1, 'sym');
    press(editor()!, 'Escape');
    expect(edits).toHaveLength(0);
    expect(document.activeElement).toBe(gridEl());
  });

  it('Tab commits and moves to the next cell; Shift+Tab to the previous one', () => {
    mount();
    openOn(1, 'sym');
    (editor() as HTMLInputElement).value = 'AAY';
    press(editor()!, 'Tab');
    expect(edits.map((e) => e.value)).toEqual(['AAY']);
    expect(document.activeElement).toBe(gridEl());
    expect(active()).toBe('r0-c1');
    press(gridEl(), 'Enter');
    press(editor()!, 'Tab', { shiftKey: true });
    expect(active()).toBe('r0-c0');
  });

  it('F2 opens the editor too', () => {
    mount();
    m!.api().focusCell(2, 'sym');
    flushSync();
    press(gridEl(), 'F2');
    expect((editor() as HTMLInputElement).value).toBe('BBB');
  });
});

describe('number editor', () => {
  it('keeps a minus sign and a decimal point as typed', () => {
    mount();
    m!.api().focusCell(1, 'px');
    flushSync();
    press(gridEl(), '-');
    const input = editor() as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('decimal');
    expect(input.value).toBe('-');
    input.value = '-3.5';
    press(input, 'Enter');
    expect(edits.map((e) => e.value)).toEqual([-3.5]);
  });

  it('refuses a blank instead of writing 0', () => {
    mount();
    openOn(1, 'px');
    (editor() as HTMLInputElement).value = '  ';
    press(editor()!, 'Enter');
    expect(edits).toHaveLength(0);
  });
});

describe('a live value while editing', () => {
  it('a tick on the cell does not overwrite what the user is typing', () => {
    mount();
    openOn(1, 'px');
    (editor() as HTMLInputElement).value = '12';
    m!.api().patchRows([[1, { px: 77.77 }]]);
    flushSync();
    expect((editor() as HTMLInputElement).value).toBe('12');
    press(editor()!, 'Enter');
    expect(edits.map((e) => e.value)).toEqual([12]);
  });
});

describe('select editor', () => {
  it('commits as soon as the pointer picks an option', () => {
    mount();
    openOn(1, 'side');
    const select = editor() as HTMLSelectElement;
    select.dispatchEvent(new Event('pointerup', { bubbles: true }));
    select.value = 'Sell';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(edits.map((e) => e.value)).toEqual(['Sell']);
    expect(document.activeElement).toBe(gridEl());
  });

  it('a change from the arrow keys waits for Enter', () => {
    mount();
    openOn(1, 'side');
    const select = editor() as HTMLSelectElement;
    select.value = 'Sell';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(edits).toHaveLength(0);
    expect(editor()).not.toBeNull();
    press(select, 'Enter');
    expect(edits.map((e) => e.value)).toEqual(['Sell']);
  });
});

describe('Tab at the end of a row', () => {
  it('goes on to the first cell of the next row', () => {
    mount();
    openOn(1, 'side');
    press(editor()!, 'Tab');
    expect(active()).toBe('r1-c0');
  });
});

describe('sorting', () => {
  it('keeps the focus on its row, as the docs promise', () => {
    mount();
    m!.api().focusCell(1, 'sym');
    flushSync();
    expect(active()).toBe('r0-c0');
    // Sort Px descending (click twice): AAA (10) moves below BBB (20).
    const px = m!.target.querySelectorAll('[role=columnheader]')[1] as HTMLElement;
    px.click();
    flushSync();
    px.click();
    flushSync();
    expect(active()).toBe('r1-c0');
    expect(m!.api().getFocusedCell()?.row.id).toBe(1);
  });
});

describe('group headers and the keyboard', () => {
  it('a focused group header is announced, marked, and toggled by Enter', () => {
    m = mountGrid({
      columns: [
        { type: 'text', key: 'sym', header: 'Sym' },
        { type: 'text', key: 'sector', header: 'Sector' },
      ],
      rows: [
        { id: 1, sym: 'AAA', sector: 'Bank' },
        { id: 2, sym: 'BBB', sector: 'Bank' },
        { id: 3, sym: 'CCC', sector: 'Tech' },
      ],
      groupBy: ['sector'],
    });
    m.api().focusCell(1, 'sym');
    flushSync();
    press(gridEl(), 'Home', { ctrlKey: true });
    const id = gridEl().getAttribute('aria-activedescendant')!;
    expect(id).toMatch(/-r0-g$/);
    const cell = document.getElementById(id)!;
    expect(cell).not.toBeNull();
    expect(cell.closest('.group')!.classList.contains('focused')).toBe(true);
    const rowsBefore = m.target.querySelectorAll('.viewport .row').length;
    press(gridEl(), 'Enter');
    expect(m.target.querySelectorAll('.viewport .row').length).toBe(rowsBefore - 2);
    // The header keeps the focus, and says it is closed.
    expect(gridEl().getAttribute('aria-activedescendant')).toBe(id);
    expect(document.getElementById(id)!.getAttribute('aria-expanded')).toBe('false');
    press(gridEl(), 'ArrowRight');
    expect(m.target.querySelectorAll('.viewport .row').length).toBe(rowsBefore);
    // Shift+arrow extends a selection; it does not toggle the group.
    press(gridEl(), 'ArrowLeft', { shiftKey: true });
    expect(m.target.querySelectorAll('.viewport .row').length).toBe(rowsBefore);
  });

  it('the focus on a group header follows it when the rows above change', () => {
    m = mountGrid({
      columns: [
        { type: 'text', key: 'sym', header: 'Sym' },
        { type: 'text', key: 'sector', header: 'Sector' },
      ],
      rows: [
        { id: 1, sym: 'AAA', sector: 'Bank' },
        { id: 2, sym: 'BBB', sector: 'Bank' },
        { id: 3, sym: 'CCC', sector: 'Tech' },
      ],
      groupBy: ['sector'],
    });
    // Focus the Tech header (r3), then collapse Bank above it (r0 by click).
    m.api().focusCell(3, 'sym');
    flushSync();
    press(gridEl(), 'ArrowUp');
    expect(gridEl().getAttribute('aria-activedescendant')).toMatch(/-r3-g$/);
    (m.target.querySelector('.grouprow .toggle') as HTMLElement).click();
    flushSync();
    // The click put the focus on Bank (r0), now closed; Tech is at r1.
    expect(gridEl().getAttribute('aria-activedescendant')).toMatch(/-r0-g$/);
    press(gridEl(), 'ArrowDown');
    expect(gridEl().getAttribute('aria-activedescendant')).toMatch(/-r1-g$/);
  });
});

describe('a row source', () => {
  it('a new sort clears the selection (its rows reload)', async () => {
    const { createArraySource } = await import('./source');
    const source = createArraySource(rows());
    m = mountGrid({ columns, rows: [], source, height: 200 });
    await Promise.resolve();
    flushSync();
    const cell = m.target.querySelector('[id$="-r0-c0"]') as HTMLElement;
    cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    flushSync();
    expect(active()).toBe('r0-c0');
    (m.target.querySelectorAll('[role=columnheader]')[0] as HTMLElement).click();
    flushSync();
    expect(active()).toBeNull();
  });
});
