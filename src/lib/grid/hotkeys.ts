// Keys an app binds on the grid: B or S on the focused row, Delete to
// cancel, Mod+K to open a ticket. Bindings are written as 'B', 'Shift+B',
// 'Mod+S' (Ctrl or ⌘), 'Delete', '?'; the grid runs a binding
// before its own keys.

import type { ColumnDef, GridRow } from './column';

/** What a hotkey's handler is given. */
export interface HotkeyContext {
  /** The focused row, or null when no data row has the focus. */
  row: GridRow | null;
  /** The focused column, or null. */
  column: ColumnDef | null;
  event: KeyboardEvent;
}

/** A hotkey's handler. Return false to leave the key to the grid. */
export type HotkeyHandler = (ctx: HotkeyContext) => void | boolean;

/** Bindings ('B', 'Shift+B', 'Mod+S', 'Delete', '?') to their handlers. */
export type Hotkeys = Readonly<Record<string, HotkeyHandler>>;

type Keys = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

const MODIFIERS: Record<string, 'ctrl' | 'meta' | 'alt' | 'shift' | 'mod'> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  mod: 'mod',
};

const ALIASES: Record<string, string> = {
  esc: 'escape',
  space: ' ',
  spacebar: ' ',
  del: 'delete',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  return: 'enter',
};

/** A binding as the grid compares it: modifiers in one order, then the key
    in lower case ('ctrl+shift+b'). */
function canonical(mods: ReadonlySet<string>, key: string): string {
  const order = ['ctrl', 'meta', 'alt', 'shift'].filter((m) => mods.has(m));
  return [...order, key].join('+');
}

/** Reads the bindings, once per change of the map. Mod becomes both Ctrl and
    Meta. Throws on a binding it cannot read, so a typo shows at once rather
    than as a key that never fires. */
export function compileHotkeys<H>(map: Readonly<Record<string, H>>): Map<string, H> {
  const out = new Map<string, H>();
  for (const [binding, handler] of Object.entries(map)) {
    // The last part is the key; '+' alone, or after a '+', is the plus key.
    let rest: string;
    let rawKey: string;
    if (binding === '+' || binding.endsWith('++')) {
      rawKey = '+';
      rest = binding.slice(0, -2);
    } else {
      const i = binding.lastIndexOf('+');
      rawKey = binding.slice(i + 1).trim();
      rest = i < 0 ? '' : binding.slice(0, i);
    }
    if (!rawKey) throw new Error(`bo-grid hotkeys: no key in "${binding}"`);
    const mods = new Set<string>();
    for (const p of rest ? rest.split('+') : []) {
      const m = MODIFIERS[p.trim().toLowerCase()];
      if (!m) throw new Error(`bo-grid hotkeys: unknown modifier "${p.trim()}" in "${binding}"`);
      mods.add(m);
    }
    const lower = rawKey.toLowerCase();
    const key = ALIASES[lower] ?? lower;
    if (mods.has('shift') && !shiftCounts(key)) {
      throw new Error(`bo-grid hotkeys: "${binding}" cannot fire; bind the character Shift types instead (e.g. '?' or '!')`);
    }
    const combos = mods.has('mod')
      ? [canonical(new Set([...mods, 'ctrl']), key), canonical(new Set([...mods, 'meta']), key)]
      : [canonical(mods, key)];
    for (const combo of combos) {
      if (out.has(combo)) throw new Error(`bo-grid hotkeys: "${binding}" binds a key already bound`);
      out.set(combo, handler);
    }
  }
  return out;
}

/** Whether Shift is part of a binding for `key`: for a letter, Space or a
    named key. A symbol is matched by the character Shift types instead. */
function shiftCounts(key: string): boolean {
  return key.length > 1 || key === ' ' || /^[a-z]$/.test(key);
}

/** The binding a keydown matches, if any. Shift counts for a letter, Space
    or a named key; a symbol is matched by the character it types ('?', '+'),
    whatever it took to type it. A key that types something other than a
    Latin letter or digit is also matched by its place on the keyboard, so
    'b' fires on a layout that types another alphabet there, and with a
    modifier that changes the character (Option+B on a Mac types '∫'). */
export function hotkeyFor<H>(e: Keys & Partial<Pick<KeyboardEvent, 'code'>>, keys: ReadonlyMap<string, H>): H | undefined {
  if (keys.size === 0) return undefined;
  const find = (key: string): H | undefined => {
    const mods = new Set<string>();
    if (e.ctrlKey) mods.add('ctrl');
    if (e.metaKey) mods.add('meta');
    if (e.altKey) mods.add('alt');
    if (e.shiftKey && shiftCounts(key)) mods.add('shift');
    return keys.get(canonical(mods, key));
  };
  const key = e.key.toLowerCase();
  const hit = find(key);
  if (hit !== undefined) return hit;
  const at = /^(?:Key([A-Z])|Digit(\d))$/.exec(e.code ?? '');
  const placed = at ? (at[1] ?? at[2]).toLowerCase() : undefined;
  // Only when the key typed something else: on a Latin layout with letters
  // elsewhere (AZERTY's A where QWERTY has Q), the letter typed is the one.
  return placed !== undefined && placed !== key && !/^[a-z0-9]$/.test(key) ? find(placed) : undefined;
}
