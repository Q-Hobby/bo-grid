// Runtime column state the user changes: the order (header drag), widths
// (resize, autosize), autoWidth measurements, and the columns hidden or pinned
// from the column menu. Order, widths, hidden and pinned columns are saved
// under persistKey (persist.ts) and come back on mount; autoWidth
// measurements are not saved. Create it while the grid initialises: the
// constructor's effects reload the saved state when the inputs change.
import { untrack } from 'svelte';
import { loadSaved, saveValue, storageKey } from './persist';
import { moveIndex } from './reorder';
import type { WidthMap } from './sizing';

export type PinSide = 'left' | 'right' | false;

export class ColumnState {
  /** Display order, as indices into the columns. */
  order = $state<number[]>([]);
  /** The user's widths (drag-resize, autosize), by column key. */
  widths = $state<WidthMap>({});
  /** autoWidth content widths measured on screen (grow-only), by column key. */
  autoMeasured = $state<Record<string, number>>({});
  /** Columns hidden from the column menu; the grid unions the hiddenColumns prop. */
  hidden = $state<string[]>([]);
  /** Pin sides set from the column menu, over each column's own `pinned`. */
  pins = $state<Record<string, PinSide>>({});

  constructor(
    private readonly persistKey: () => string | undefined,
    columns: () => readonly unknown[],
  ) {
    // A new column set starts from its saved order, else the order given.
    $effect(() => {
      const n = columns().length;
      untrack(() => {
        const base = Array.from({ length: n }, (_, i) => i);
        const saved = loadSaved(this.key('order'));
        this.order = Array.isArray(saved) && saved.length === n && base.every((i) => saved.includes(i)) ? saved : base;
      });
    });
    // A persistKey brings back that layout's widths, hidden and pinned columns.
    $effect(() => {
      const widths = this.key('widths');
      const hidden = this.key('hidden');
      const pins = this.key('pin');
      untrack(() => {
        const w = loadSaved(widths);
        if (w && typeof w === 'object') this.widths = w as WidthMap;
        const h = loadSaved(hidden);
        if (Array.isArray(h)) this.hidden = h.filter((k) => typeof k === 'string');
        const p = loadSaved(pins);
        if (p && typeof p === 'object') this.pins = p as Record<string, PinSide>;
      });
    });
  }

  /** Moves a column in the display order and saves it. */
  move(from: number, to: number): void {
    this.setOrder(moveIndex(this.order, from, to));
  }

  setOrder(next: number[]): void {
    this.order = next;
    saveValue(this.key('order'), next);
  }

  /** Saves the current widths (a drag updates them on every move, saves at the end). */
  saveWidths(): void {
    saveValue(this.key('widths'), this.widths);
  }

  setWidth(key: string, width: number): void {
    this.widths = { ...this.widths, [key]: width };
    this.saveWidths();
  }

  /** Drops the user's width for a column. False when it had none. */
  resetWidth(key: string): boolean {
    if (this.widths[key] == null) return false;
    const next = { ...this.widths };
    delete next[key];
    this.widths = next;
    this.saveWidths();
    return true;
  }

  setHidden(next: string[]): void {
    this.hidden = next;
    saveValue(this.key('hidden'), next);
  }

  setPin(key: string, side: PinSide): void {
    this.setPins({ ...this.pins, [key]: side });
  }

  setPins(next: Record<string, PinSide>): void {
    this.pins = next;
    saveValue(this.key('pin'), next);
  }

  /** A column's pin side: the column menu's choice, else its own `pinned`. */
  pinSideOf(key: string, own: boolean | 'left' | 'right' | undefined): PinSide {
    if (key in this.pins) return this.pins[key];
    return own === true ? 'left' : own || false;
  }

  private key(part: string): string | null {
    return storageKey(part, this.persistKey());
  }
}
