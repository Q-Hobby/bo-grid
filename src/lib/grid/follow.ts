// The focus, the selection and an open editor belong to rows, not to places:
// on a live list, rows added, removed or reordered around the focused one
// would otherwise slide another row under the highlight, under a hotkey, or
// under the editor's commit. The grid looks a row up again with findRow when
// the view changes.
import type { GridRow } from './column';
import type { VisualRow } from './grouping';

/** How far either side of its old place a row is looked for before the
    whole view: a live list moves a row a few places at a time. */
const NEAR = 64;

/** The index of the data row with `id` in `items`, looked for around `near`
    first; -1 when it is no longer there. */
export function findRow(items: readonly VisualRow[], id: unknown, near: number, getId: (row: GridRow) => unknown): number {
  const at = (i: number): boolean => {
    const item = items[i];
    return item !== undefined && item.kind === 'data' && getId(item.row) === id;
  };
  for (let d = 0; d <= NEAR; d++) {
    if (at(near - d)) return near - d;
    if (d > 0 && at(near + d)) return near + d;
  }
  for (let i = 0; i < items.length; i++) if (Math.abs(i - near) > NEAR && at(i)) return i;
  return -1;
}
