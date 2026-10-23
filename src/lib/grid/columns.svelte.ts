// Runtime column state the user changes: the order (header drag), widths
// (resize, autosize), autoWidth measurements, and the columns hidden or pinned
// from the column menu. Order, widths, hidden and pinned columns are saved
// under persistKey (persist.ts) and come back on mount; autoWidth
// measurements are not saved. Create it while the grid initialises: its
// effects reload the saved state when the inputs change. A factory rather
// than a class, so its state stays in local variables, which minify.
import { untrack } from 'svelte';
import { loadSaved, saveValue, storageKey } from './persist';
import { moveIndex } from './reorder';
import type { WidthMap } from './sizing';

export type PinSide = 'left' | 'right' | false;

export interface ColumnState {
  /** Display order, as indices into the columns. */
  readonly order: number[];
  /** The user's widths (drag-resize, autosize), by column key. A drag sets
      them on every move and saves them at the end (saveWidths). */
  widths: WidthMap;
  /** autoWidth content widths measured on screen (grow-only), by column key. */
  autoMeasured: Record<string, number>;
  /** Columns hidden from the column menu; the grid unions the hiddenColumns prop. */
  readonly hidden: string[];
  /** Pin sides set from the column menu, over each column's own `pinned`. */
  readonly pins: Record<string, PinSide>;
  /** Moves a column in the display order and saves it. */
  move(from: number, to: number): void;
  setOrder(next: number[]): void;
  saveWidths(): void;
  setWidth(key: string, width: number): void;
  /** Drops the user's width for a column. False when it had none. */
  resetWidth(key: string): boolean;
  setHidden(next: string[]): void;
  setPin(key: string, side: PinSide): void;
  setPins(next: Record<string, PinSide>): void;
  /** A column's pin side: the column menu's choice, else its own `pinned`. */
  pinSideOf(key: string, own: boolean | 'left' | 'right' | undefined): PinSide;
}

export function createColumnState(persistKey: () => string | undefined, columns: () => readonly unknown[]): ColumnState {
  let order = $state<number[]>([]);
  let widths = $state<WidthMap>({});
  let autoMeasured = $state<Record<string, number>>({});
  let hidden = $state<string[]>([]);
  let pins = $state<Record<string, PinSide>>({});
  const key = (part: string) => storageKey(part, persistKey());

  // A new column set starts from its saved order, else the order given.
  $effect(() => {
    const n = columns().length;
    untrack(() => {
      const base = Array.from({ length: n }, (_, i) => i);
      const saved = loadSaved(key('order'));
      order = Array.isArray(saved) && saved.length === n && base.every((i) => saved.includes(i)) ? saved : base;
    });
  });
  // A persistKey brings back that layout's widths, hidden and pinned columns.
  $effect(() => {
    const keys = [key('widths'), key('hidden'), key('pin')];
    untrack(() => {
      const w = loadSaved(keys[0]);
      if (w && typeof w === 'object') widths = w as WidthMap;
      const h = loadSaved(keys[1]);
      if (Array.isArray(h)) hidden = h.filter((k) => typeof k === 'string');
      const p = loadSaved(keys[2]);
      if (p && typeof p === 'object') pins = p as Record<string, PinSide>;
    });
  });

  const state: ColumnState = {
    get order() {
      return order;
    },
    get widths() {
      return widths;
    },
    set widths(next) {
      widths = next;
    },
    get autoMeasured() {
      return autoMeasured;
    },
    set autoMeasured(next) {
      autoMeasured = next;
    },
    get hidden() {
      return hidden;
    },
    get pins() {
      return pins;
    },
    move: (from, to) => state.setOrder(moveIndex(order, from, to)),
    setOrder(next) {
      order = next;
      saveValue(key('order'), next);
    },
    saveWidths: () => saveValue(key('widths'), widths),
    setWidth(k, width) {
      widths = { ...widths, [k]: width };
      state.saveWidths();
    },
    resetWidth(k) {
      if (widths[k] == null) return false;
      const next = { ...widths };
      delete next[k];
      widths = next;
      state.saveWidths();
      return true;
    },
    setHidden(next) {
      hidden = next;
      saveValue(key('hidden'), next);
    },
    setPin: (k, side) => state.setPins({ ...pins, [k]: side }),
    setPins(next) {
      pins = next;
      saveValue(key('pin'), next);
    },
    pinSideOf: (k, own) => (k in pins ? pins[k] : own === true ? 'left' : own || false),
  };
  return state;
}
