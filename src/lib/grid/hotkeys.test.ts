import { describe, expect, it } from 'vitest';
import { compileHotkeys, hotkeyFor } from './hotkeys';
import { findRow } from './follow';
import type { GridRow } from './column';
import type { VisualRow } from './grouping';

const key = (k: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey', boolean>> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe('hotkeys', () => {
  const b = () => {};
  const shiftB = () => {};
  const del = () => {};
  const save = () => {};
  const help = () => {};
  const keys = compileHotkeys({ b, 'Shift+B': shiftB, Delete: del, 'Mod+S': save, '?': help });

  it('matches a letter whatever its case, and Shift as its own binding', () => {
    expect(hotkeyFor(key('b'), keys)).toBe(b);
    expect(hotkeyFor(key('B', { shiftKey: true }), keys)).toBe(shiftB);
    expect(hotkeyFor(key('b', { altKey: true }), keys)).toBeUndefined();
    expect(hotkeyFor(key('b', { ctrlKey: true }), keys)).toBeUndefined();
  });

  it('matches named keys, Mod as Ctrl or Meta, and a symbol by the character it types', () => {
    expect(hotkeyFor(key('Delete'), keys)).toBe(del);
    expect(hotkeyFor(key('s', { ctrlKey: true }), keys)).toBe(save);
    expect(hotkeyFor(key('s', { metaKey: true }), keys)).toBe(save);
    expect(hotkeyFor(key('?', { shiftKey: true }), keys)).toBe(help);
  });

  it('reads modifiers in any order and case, aliases and the plus key', () => {
    const plus = () => {};
    const esc = () => {};
    const space = () => {};
    const up = () => {};
    const k = compileHotkeys({ 'shift+ctrl+X': b, '+': plus, Esc: esc, Space: space, 'Alt+Up': up });
    expect(hotkeyFor(key('X', { ctrlKey: true, shiftKey: true }), k)).toBe(b);
    expect(hotkeyFor(key('+', { shiftKey: true }), k)).toBe(plus);
    expect(hotkeyFor(key('Escape'), k)).toBe(esc);
    expect(hotkeyFor(key(' '), k)).toBe(space);
    expect(hotkeyFor(key('ArrowUp', { altKey: true }), k)).toBe(up);
  });

  it('throws on a binding it cannot read, so a typo shows at once', () => {
    expect(() => compileHotkeys({ 'Ctl+B': b })).toThrow(/Ctl/);
    expect(() => compileHotkeys({ '': b })).toThrow();
    expect(() => compileHotkeys({ 'Shift+': b })).toThrow();
  });

  it('throws on a Shift binding that can never fire, and on a key bound twice', () => {
    expect(() => compileHotkeys({ 'Shift+1': b })).toThrow(/cannot fire/);
    expect(() => compileHotkeys({ 'Shift+/': b })).toThrow(/cannot fire/);
    expect(() => compileHotkeys({ 'Mod+K': b, 'Ctrl+K': b })).toThrow(/already bound/);
    expect(() => compileHotkeys({ b, B: b })).toThrow(/already bound/);
  });

  it('counts Shift with Space', () => {
    const plain = () => {};
    const shifted = () => {};
    const k = compileHotkeys({ Space: plain, 'Shift+Space': shifted });
    expect(hotkeyFor(key(' '), k)).toBe(plain);
    expect(hotkeyFor(key(' ', { shiftKey: true }), k)).toBe(shifted);
  });

  it('matches a letter by its place when the layout types another alphabet there', () => {
    const k = compileHotkeys({ b, 'Alt+B': shiftB, q: del });
    expect(hotkeyFor({ ...key('и'), code: 'KeyB' }, k)).toBe(b);
    expect(hotkeyFor({ ...key('∫', { altKey: true }), code: 'KeyB' }, k)).toBe(shiftB);
    // AZERTY: the key where QWERTY has Q types A; it is A, not Q.
    expect(hotkeyFor({ ...key('a'), code: 'KeyQ' }, k)).toBeUndefined();
  });
});

describe('findRow', () => {
  const rows = (ids: number[]): VisualRow[] => ids.map((id) => ({ kind: 'data', row: { id } }));
  const id = (r: GridRow) => r.id;

  it('finds a row near where it was, and anywhere else', () => {
    const items = rows([5, 1, 2, 3, 4]);
    expect(findRow(items, 3, 2, id)).toBe(3);
    expect(findRow(items, 5, 4, id)).toBe(0);
    const long = rows(Array.from({ length: 1000 }, (_, i) => i));
    expect(findRow(long, 999, 0, id)).toBe(999);
  });

  it('skips group headers, and gives -1 for a row that is gone', () => {
    const items: VisualRow[] = [{ kind: 'treeloading', depth: 0 }, ...rows([1, 2])];
    expect(findRow(items, 2, 0, id)).toBe(2);
    expect(findRow(items, 9, 1, id)).toBe(-1);
  });
});
