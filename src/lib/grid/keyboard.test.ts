import { describe, expect, it } from 'vitest';
import { keyAction, type KeyState } from './keyboard';

const item = { label: 'Buy', onSelect: () => {} };

/** A 10 x 4 grid focused at (2, 1), nothing enabled unless overridden. */
function state(over: Partial<KeyState> = {}): KeyState {
  return {
    focus: { r: 2, c: 1 },
    editing: false,
    maxR: 9,
    maxC: 3,
    pageRows: 5,
    rowClick: false,
    rowSelection: false,
    findBar: false,
    canUndo: false,
    canRedo: false,
    columnMenu: false,
    canEdit: () => false,
    canTypeToEdit: () => false,
    hasRow: () => true,
    rowMenuItems: () => [],
    treeNode: () => null,
    groupNode: () => null,
    ...over,
  };
}
const press = (key: string, mods: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('keyAction: editing and activation', () => {
  it('Enter edits an editable cell, else activates the row, else is left alone', () => {
    expect(keyAction(press('Enter'), state({ canEdit: () => true }))).toEqual({ kind: 'edit', r: 2, c: 1, seed: null });
    expect(keyAction(press('Enter'), state({ rowClick: true }))).toEqual({ kind: 'rowClick', r: 2 });
    expect(keyAction(press('Enter'), state({ rowClick: true, hasRow: () => false }))).toBeNull();
    expect(keyAction(press('Enter'), state())).toBeNull();
  });

  it('nothing opens an editor while one is open', () => {
    const s = state({ editing: true, canEdit: () => true, canTypeToEdit: () => true });
    expect(keyAction(press('Enter'), s)).toBeNull();
    expect(keyAction(press('q'), s)).toBeNull();
  });

  it('a printable key opens the editor seeded with it, without modifiers only', () => {
    const s = state({ canTypeToEdit: () => true });
    expect(keyAction(press('7'), s)).toEqual({ kind: 'edit', r: 2, c: 1, seed: '7' });
    expect(keyAction(press('7', { altKey: true }), s)).toBeNull();
    expect(keyAction(press('q'), state())).toBeNull();
  });

  it('Space toggles the focused row only with the checkbox column on', () => {
    expect(keyAction(press(' '), state({ rowSelection: true }))).toEqual({ kind: 'toggleRow', r: 2 });
    expect(keyAction(press(' '), state())).toBeNull();
  });
});

describe('keyAction: shortcuts', () => {
  it('Ctrl or ⌘ + Z / Y / Shift+Z undo and redo only when there is something to undo or redo', () => {
    expect(keyAction(press('z', { ctrlKey: true }), state({ canUndo: true }))).toEqual({ kind: 'undo' });
    expect(keyAction(press('z', { metaKey: true }), state())).toBeNull();
    expect(keyAction(press('y', { ctrlKey: true }), state({ canRedo: true }))).toEqual({ kind: 'redo' });
    expect(keyAction(press('Z', { ctrlKey: true, shiftKey: true }), state({ canRedo: true }))).toEqual({ kind: 'redo' });
    expect(keyAction(press('z', { ctrlKey: true }), state({ canRedo: true }))).toBeNull();
  });

  it('select all, copy and paste work without a focused cell', () => {
    const s = state({ focus: null });
    expect(keyAction(press('a', { ctrlKey: true }), s)).toEqual({ kind: 'selectAll' });
    expect(keyAction(press('c', { metaKey: true }), s)).toEqual({ kind: 'copy' });
    expect(keyAction(press('v', { ctrlKey: true }), s)).toEqual({ kind: 'paste' });
  });

  it('Ctrl+F opens find only when the find bar is on', () => {
    expect(keyAction(press('f', { ctrlKey: true }), state({ findBar: true }))).toEqual({ kind: 'find' });
    expect(keyAction(press('f', { ctrlKey: true }), state())).toBeNull();
  });

  it('Escape clears', () => {
    expect(keyAction(press('Escape'), state())).toEqual({ kind: 'clear' });
  });
});

describe('keyAction: menus and trees', () => {
  it('ContextMenu or Shift+F10 opens the row menu when it has items', () => {
    const s = state({ rowMenuItems: () => [item] });
    expect(keyAction(press('ContextMenu'), s)).toEqual({ kind: 'rowMenu', items: [item] });
    expect(keyAction(press('F10', { shiftKey: true }), s)).toEqual({ kind: 'rowMenu', items: [item] });
    expect(keyAction(press('ContextMenu'), state())).toBeNull();
  });

  it('Alt+ArrowDown opens the column menu when it is on, else moves down', () => {
    expect(keyAction(press('ArrowDown', { altKey: true }), state({ columnMenu: true }))).toEqual({ kind: 'columnMenu', c: 1 });
    expect(keyAction(press('ArrowDown', { altKey: true }), state())).toEqual({ kind: 'move', dr: 1, dc: 0, extend: false });
  });

  it('ArrowRight opens a closed tree node, ArrowLeft closes an open one, else they move', () => {
    expect(keyAction(press('ArrowRight'), state({ treeNode: () => 'closed' }))).toEqual({ kind: 'toggleTree', r: 2 });
    expect(keyAction(press('ArrowLeft'), state({ treeNode: () => 'open' }))).toEqual({ kind: 'toggleTree', r: 2 });
    expect(keyAction(press('ArrowRight'), state({ treeNode: () => 'open' }))).toEqual({ kind: 'move', dr: 0, dc: 1, extend: false });
    expect(keyAction(press('ArrowLeft'), state({ treeNode: () => 'closed' }))).toEqual({ kind: 'move', dr: 0, dc: -1, extend: false });
  });

  it('a group header: Enter / Space toggle it, ArrowRight opens and ArrowLeft closes it', () => {
    const open = state({ groupNode: () => 'open', canEdit: () => true });
    const closed = state({ groupNode: () => 'closed' });
    expect(keyAction(press('Enter'), open)).toEqual({ kind: 'toggleGroup', r: 2 });
    expect(keyAction(press(' '), closed)).toEqual({ kind: 'toggleGroup', r: 2 });
    expect(keyAction(press('ArrowLeft'), open)).toEqual({ kind: 'toggleGroup', r: 2 });
    expect(keyAction(press('ArrowRight'), closed)).toEqual({ kind: 'toggleGroup', r: 2 });
    expect(keyAction(press('ArrowRight'), open)).toEqual({ kind: 'move', dr: 0, dc: 1, extend: false });
    expect(keyAction(press('ArrowDown'), open)).toEqual({ kind: 'move', dr: 1, dc: 0, extend: false });
  });
});

describe('keyAction: navigation', () => {
  it('Home and End stay in the row; with Ctrl they reach the grid corners', () => {
    expect(keyAction(press('Home'), state())).toEqual({ kind: 'focus', r: 2, c: 0, extend: false });
    expect(keyAction(press('End'), state())).toEqual({ kind: 'focus', r: 2, c: 3, extend: false });
    expect(keyAction(press('Home', { ctrlKey: true }), state())).toEqual({ kind: 'focus', r: 0, c: 0, extend: false });
    expect(keyAction(press('End', { ctrlKey: true, shiftKey: true }), state())).toEqual({ kind: 'focus', r: 9, c: 3, extend: true });
  });

  it('PageUp and PageDown move by a page (the grid clamps)', () => {
    expect(keyAction(press('PageDown'), state())).toEqual({ kind: 'focus', r: 7, c: 1, extend: false });
    expect(keyAction(press('PageUp'), state())).toEqual({ kind: 'focus', r: -3, c: 1, extend: false });
  });

  it('arrows move, extending with Shift, even with no focused cell', () => {
    expect(keyAction(press('ArrowUp', { shiftKey: true }), state({ focus: null }))).toEqual({ kind: 'move', dr: -1, dc: 0, extend: true });
  });

  it('other keys are left to the browser', () => {
    expect(keyAction(press('Tab'), state())).toBeNull();
    expect(keyAction(press('Home'), state({ focus: null }))).toBeNull();
  });
});
