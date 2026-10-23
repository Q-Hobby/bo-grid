// Live re-sorting for rows patched in place (`api.patchRows` with `liveSort`).
//
// Re-sorting the whole view costs n log n comparisons every time. When k rows
// changed since the view was built, the other rows are still in order among
// themselves: take the changed rows out, keep those that still pass the
// filters, sort those k and merge the two sorted runs. That is n + k log k
// comparisons, a small fraction of a re-sort on a large board. Ties fall back
// to the rows' order in `rows`, as sortRows does, so the result is the same as
// filtering and sorting from scratch.
import type { ColumnDef, GridRow, SortState } from './column';
import { compareBySorts } from './column';

/** A total order for rows: the sorts, then the row's position in `rows`. */
export function rowOrder(
  sorts: readonly SortState[],
  columns: readonly ColumnDef[],
  position: (row: GridRow) => number,
): (a: GridRow, b: GridRow) => number {
  const byKey = new Map(columns.map((c) => [c.key, c] as const));
  const colOf = (key: string) => byKey.get(key);
  return (a, b) => compareBySorts(a, b, sorts, colOf) || position(a) - position(b);
}

/** The view after `changed` rows moved: `view` without them, plus those that
    pass, merged in by `order`. `view` must already be in `order` and hold
    only rows that passed when it was built; changed rows that were filtered
    out may come back in. */
export function mergeChanged<T>(
  view: readonly T[],
  changed: ReadonlySet<T>,
  passes: ((row: T) => boolean) | null,
  order: (a: T, b: T) => number,
): T[] {
  const kept: T[] = [];
  for (const row of view) if (!changed.has(row)) kept.push(row);
  const moved: T[] = [];
  for (const row of changed) if (!passes || passes(row)) moved.push(row);
  if (moved.length === 0) return kept;
  moved.sort(order);
  // Each moved row finds its place by binary search in what is left of
  // `kept`; the runs between places are copied without comparing anything.
  const out = new Array<T>(kept.length + moved.length);
  let i = 0;
  let o = 0;
  for (const row of moved) {
    let lo = i;
    let hi = kept.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (order(row, kept[mid]) < 0) hi = mid;
      else lo = mid + 1;
    }
    while (i < lo) out[o++] = kept[i++];
    out[o++] = row;
  }
  while (i < kept.length) out[o++] = kept[i++];
  return out;
}
