// How a new `rows` array differs from the previous one, when the app adds and
// removes rows the immutable way (`rows = [...rows, order]`,
// `rows = rows.filter(...)`). One pass compares rows by identity; a row is
// only looked up (through `known`) where the two arrays stop matching. The
// grid uses the diff to update its row index, its sorted view and its totals
// instead of rebuilding them.

export interface RowsDiff<T> {
  added: T[];
  removed: T[];
}

/** The rows added to and removed from `prev` to make `next`, if rows were only
    added and removed (the rows kept stay in the same relative order).
    `known(row)` says whether a row of `next` was in `prev`. Null when rows were
    reordered, or when more than `limit` rows changed (a rebuild is then about
    as cheap). A row object replaced by a copy counts as removed and added. */
export function diffRows<T>(prev: readonly T[], next: readonly T[], known: (row: T) => boolean, limit: number): RowsDiff<T> | null {
  const added: T[] = [];
  const removed: T[] = [];
  let i = 0;
  let j = 0;
  while (j < next.length) {
    const row = next[j];
    if (i < prev.length && prev[i] === row) {
      i++;
      j++;
      continue;
    }
    if (!known(row)) {
      added.push(row);
      j++;
    } else {
      // A row of `prev` that is not here yet: `prev[i]` was removed, or the
      // rows were reordered. A reorder always runs out of `prev` before this
      // row turns up, because every row skipped is counted removed.
      if (i >= prev.length) return null;
      removed.push(prev[i]);
      i++;
    }
    if (added.length + removed.length > limit) return null;
  }
  while (i < prev.length) {
    removed.push(prev[i++]);
    if (added.length + removed.length > limit) return null;
  }
  return { added, removed };
}
