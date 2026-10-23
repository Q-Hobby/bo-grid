// The grid's keyboard model (role=grid, focus via aria-activedescendant): what
// a keydown on the grid does. keyAction decides from a snapshot of the grid's
// state; the grid runs the action. The checks run in order, and a key whose
// check does not apply falls through to the next ones, so for example Ctrl+Z
// with nothing to undo is left to the browser.

type Pos = { r: number; c: number };
type MenuItem = { label: string; onSelect: () => void };

export type KeyAction =
  | { kind: 'edit'; r: number; c: number; seed: string | null }
  | { kind: 'rowClick'; r: number }
  | { kind: 'toggleRow'; r: number }
  | { kind: 'find' }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'selectAll' }
  | { kind: 'copy' }
  | { kind: 'paste' }
  | { kind: 'clear' }
  | { kind: 'rowMenu'; items: MenuItem[] }
  | { kind: 'columnMenu'; c: number }
  | { kind: 'toggleTree'; r: number }
  | { kind: 'focus'; r: number; c: number; extend: boolean }
  | { kind: 'move'; dr: number; dc: number; extend: boolean };

/** What keyAction needs to know about the grid, read when a key arrives. */
export interface KeyState {
  readonly focus: Pos | null;
  readonly editing: boolean;
  readonly maxR: number;
  readonly maxC: number;
  /** Rows a PageUp / PageDown moves. */
  readonly pageRows: number;
  readonly rowClick: boolean;
  readonly rowSelection: boolean;
  readonly findBar: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly columnMenu: boolean;
  /** Enter opens an editor on this column. */
  canEdit(c: number): boolean;
  /** A printable key opens an editor seeded with it (not dates or selects). */
  canTypeToEdit(c: number): boolean;
  /** A data row is at this index (not a group header or an unloaded row). */
  hasRow(r: number): boolean;
  /** The row menu's items for this row; empty when there is no menu. */
  rowMenuItems(r: number): MenuItem[];
  /** A tree row with children: whether it is open; null otherwise. */
  treeNode(r: number): 'open' | 'closed' | null;
}

type Keys = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/** What a keydown on the grid does, or null to leave the key to the browser.
    Every action but 'clear' takes the key (the grid cancels its default). */
export function keyAction(e: Keys, s: KeyState): KeyAction | null {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  const f = s.focus;
  if (e.key === 'Enter' && f && !s.editing) {
    if (s.canEdit(f.c)) return { kind: 'edit', r: f.r, c: f.c, seed: null };
    if (s.rowClick && s.hasRow(f.r)) return { kind: 'rowClick', r: f.r };
  }
  // Space ticks the focused row when the checkbox column is on.
  if (e.key === ' ' && s.rowSelection && f && !s.editing && s.hasRow(f.r)) return { kind: 'toggleRow', r: f.r };
  // Type-to-edit, as in a spreadsheet.
  if (!mod && !e.altKey && e.key.length === 1 && e.key !== ' ' && f && !s.editing) {
    if (s.canTypeToEdit(f.c) && s.hasRow(f.r)) return { kind: 'edit', r: f.r, c: f.c, seed: e.key };
  }
  if (mod && key === 'f' && s.findBar) return { kind: 'find' };
  if (mod && key === 'z' && !e.shiftKey && s.canUndo) return { kind: 'undo' };
  if (mod && (key === 'y' || (e.shiftKey && key === 'z')) && s.canRedo) return { kind: 'redo' };
  if (mod && key === 'a') return { kind: 'selectAll' };
  if (mod && key === 'c') return { kind: 'copy' };
  if (mod && key === 'v') return { kind: 'paste' };
  if (e.key === 'Escape') return { kind: 'clear' };
  // The row menu from the keyboard (ContextMenu key / Shift+F10).
  if (f && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) {
    const items = s.rowMenuItems(f.r);
    if (items.length > 0) return { kind: 'rowMenu', items };
  }
  // The column menu at the focused column (Alt+ArrowDown).
  if (s.columnMenu && f && e.altKey && e.key === 'ArrowDown') return { kind: 'columnMenu', c: f.c };
  // Treegrid: ArrowRight opens a closed node, ArrowLeft closes an open one;
  // otherwise the arrows move.
  if (f && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const node = s.treeNode(f.r);
    if ((e.key === 'ArrowRight' && node === 'closed') || (e.key === 'ArrowLeft' && node === 'open')) {
      return { kind: 'toggleTree', r: f.r };
    }
  }
  // Home/End within the row (with Ctrl/⌘: the whole grid); PageUp/PageDown by a page.
  if (f && (e.key === 'Home' || e.key === 'End' || e.key === 'PageUp' || e.key === 'PageDown')) {
    const extend = e.shiftKey;
    if (e.key === 'Home') return { kind: 'focus', r: mod ? 0 : f.r, c: 0, extend };
    if (e.key === 'End') return { kind: 'focus', r: mod ? s.maxR : f.r, c: s.maxC, extend };
    return { kind: 'focus', r: f.r + (e.key === 'PageDown' ? s.pageRows : -s.pageRows), c: f.c, extend };
  }
  const d = ARROWS[e.key];
  return d ? { kind: 'move', dr: d[0], dc: d[1], extend: e.shiftKey } : null;
}
