// Running totals over the grid's view, for the footer row and the data-bar /
// colour-scale ranges, kept by delta while api.patchRows ticks instead of
// rescanning every row on every tick.
//
// scanTotals() reads every cell once. The grid runs it inside a $derived, so
// the reads are tracked: $state rows edited in place, or a computed column
// that reads reactive state, invalidate the scan and it runs again, exactly
// as a full rescan always did. Plain rows are not tracked; for them the grid
// calls remove(row) before api.patchRows writes into a row and add(row)
// after, which moves sums and counts by the row's change. min and max move
// too, with a count of the rows that hold them (many rows often share one,
// such as a filled quantity of 0); only when the last of those moves inward
// is the column rescanned, when it is next read. Columns whose footer shows a
// sum, average or count keep no min and max at all.
//
// Running sums use compensated (Neumaier) addition, so one huge value that
// is later corrected does not wipe out the small ones; the grid still
// rescans after DRIFT_LIMIT updates. A computed column must depend only on
// its own row: one that reads other rows or the clock gets a fresh total on
// the next new view or api.refresh().
import type { ColumnDef, GridRow } from './column';
import { cellValue } from './column';

/** How a column's values are read:
    - footer: every finite `Number(value)`; a blank or null reads as 0, as the
      footer row has always counted it.
    - range: values that are not blank (null, undefined, ''), then finite. */
export type TotalKind = 'footer' | 'range';

export interface TotalTarget {
  col: ColumnDef;
  kind: TotalKind;
  /** Whether min and max are read (a range, or a footer showing one). */
  extremes: boolean;
}

export interface Totals {
  sum: number;
  avg: number;
  count: number;
  min: number;
  max: number;
}

export const DRIFT_LIMIT = 50_000;

interface Acc {
  target: TotalTarget;
  sum: number;
  /** Neumaier compensation: the low-order part the running sum lost. */
  comp: number;
  count: number;
  min: number;
  max: number;
  /** How many values equal min, and max. */
  atMin: number;
  atMax: number;
  /** The last value at an extreme moved inward: min and max need a rescan. */
  stale: boolean;
}

function read(t: TotalTarget, row: GridRow): number {
  const raw = cellValue(t.col, row);
  if (t.kind === 'range' && (raw === null || raw === undefined || raw === '')) return NaN;
  return Number(raw);
}

export interface ViewTotals {
  /** Delta updates since the scan. */
  readonly updates: number;
  /** Takes a row's values out, before a patch writes into it. False when the
      row is not in the view (nothing to put back after the write). */
  remove(row: GridRow): boolean;
  /** Puts a row's values back, after the write. */
  add(row: GridRow): void;
  /** The totals of one column, or null when it has no values. */
  get(kind: TotalKind, key: string): Totals | null;
}

/** Scans `view` once for every target. With `filtered`, a patched row may be
    outside the view; without it, the view holds every row. */
export function scanTotals(view: readonly GridRow[], targets: readonly TotalTarget[], filtered: boolean): ViewTotals {
  const accKey = (kind: TotalKind, key: string) => `${kind}\u0001${key}`;
  const accs = new Map<string, Acc>();
  let members: Set<GridRow> | null = null;
  let updates = 0;

  function scan(acc: Acc): void {
    let sum = 0;
    let count = 0;
    let min = Infinity;
    let max = -Infinity;
    let atMin = 0;
    let atMax = 0;
    for (const row of view) {
      const v = read(acc.target, row);
      if (!Number.isFinite(v)) continue;
      sum += v;
      count++;
      if (v < min) (min = v), (atMin = 1);
      else if (v === min) atMin++;
      if (v > max) (max = v), (atMax = 1);
      else if (v === max) atMax++;
    }
    Object.assign(acc, { sum, comp: 0, count, min, max, atMin, atMax, stale: false });
  }

  function step(row: GridRow, sign: 1 | -1): void {
    for (const acc of accs.values()) {
      const v = read(acc.target, row);
      if (!Number.isFinite(v)) continue;
      const x = sign * v;
      const t = acc.sum + x;
      acc.comp += Math.abs(acc.sum) >= Math.abs(x) ? acc.sum - t + x : x - t + acc.sum;
      acc.sum = t;
      acc.count += sign;
      if (!acc.target.extremes || acc.stale) continue;
      if (sign < 0) {
        if (v === acc.min && --acc.atMin === 0) acc.stale = true;
        if (v === acc.max && --acc.atMax === 0) acc.stale = true;
      } else {
        if (v < acc.min) (acc.min = v), (acc.atMin = 1);
        else if (v === acc.min) acc.atMin++;
        if (v > acc.max) (acc.max = v), (acc.atMax = 1);
        else if (v === acc.max) acc.atMax++;
      }
    }
  }

  for (const target of targets) {
    const acc: Acc = { target, sum: 0, comp: 0, count: 0, min: Infinity, max: -Infinity, atMin: 0, atMax: 0, stale: false };
    scan(acc);
    accs.set(accKey(target.kind, target.col.key), acc);
  }

  return {
    get updates() {
      return updates;
    },
    remove(row) {
      if (accs.size === 0) return false;
      if (filtered && !(members ??= new Set(view)).has(row)) return false;
      step(row, -1);
      updates++;
      return true;
    },
    add(row) {
      step(row, 1);
    },
    get(kind, key) {
      const acc = accs.get(accKey(kind, key));
      if (!acc || acc.count === 0) return null;
      // A rescan settles min and max, and gives exact sums while it is at it.
      if (acc.stale) scan(acc);
      const sum = acc.sum + acc.comp;
      return { sum, avg: sum / acc.count, count: acc.count, min: acc.min, max: acc.max };
    },
  };
}
