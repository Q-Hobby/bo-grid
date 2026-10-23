import type { ColumnDef } from './column';

/** Smallest width (px) a column may be dragged to. */
export const MIN_COL_WIDTH = 48;

/** User width overrides, keyed by column `key` so they survive reorder/pin. */
export type WidthMap = Record<string, number>;

/** Clamp + round a proposed drag width to [min, max], never below MIN_COL_WIDTH. */
export function clampWidth(w: number, min = MIN_COL_WIDTH, max = Infinity): number {
  const lo = Math.max(MIN_COL_WIDTH, min);
  return Math.min(Math.max(Math.round(w), lo), Math.max(lo, max));
}

/** Whether a column may be resized, given the grid-level toggle. */
export function isResizable(col: ColumnDef, gridResizable: boolean): boolean {
  return gridResizable && col.resizable !== false;
}

/**
 * Apply width overrides to a column list. An overridden column becomes
 * fixed-width (its `flex` cleared) so the dragged size sticks; in fit-to-width
 * mode the remaining flex columns absorb the difference. Untouched columns pass
 * through by reference, so the default fit-to-width layout is unchanged when no
 * column has been resized.
 */
export function applyWidths(cols: readonly ColumnDef[], widths: WidthMap): ColumnDef[] {
  let changed = false;
  const out = cols.map((c) => {
    const w = widths[c.key];
    if (w == null) return c;
    changed = true;
    return { ...c, width: w, flex: undefined } as ColumnDef;
  });
  return changed ? out : (cols as ColumnDef[]);
}

/**
 * `autoWidth`: raise columns to the content widths measured on screen. A fixed
 * column grows to the measured width (never below its own), a flex column's
 * floor rises and it keeps flexing; both stop at `maxWidth`. Columns the user
 * sized (`overrides`) and columns without `autoWidth` pass through by
 * reference, and so does the list when nothing changes.
 */
export function applyAutoWidths(
  cols: readonly ColumnDef[],
  measured: Readonly<Record<string, number>>,
  overrides: WidthMap,
): ColumnDef[] {
  let changed = false;
  const out = cols.map((c) => {
    const m = measured[c.key];
    if (!c.autoWidth || m == null || overrides[c.key] != null) return c;
    const need = Math.min(m, c.maxWidth ?? Infinity);
    const floor = Math.max(c.minWidth ?? 0, need);
    if (c.flex) {
      if (floor === (c.minWidth ?? 0)) return c;
      changed = true;
      return { ...c, minWidth: floor } as ColumnDef;
    }
    const width = Math.max(c.width ?? 96, need);
    if (width === c.width && floor === c.minWidth) return c;
    changed = true;
    return { ...c, width, minWidth: floor } as ColumnDef;
  });
  return changed ? out : (cols as ColumnDef[]);
}

/** The width that fits every text: the widest, measured, plus padding. */
export function contentWidth(texts: Iterable<string>, measure: (text: string) => number, pad: number): number {
  let max = 0;
  for (const t of texts) max = Math.max(max, measure(t));
  return Math.ceil(max) + pad;
}

/** A fitColumns drag: every column's rendered width and floor at the start,
    in display order, and which one is being dragged. */
export interface FitDrag {
  keys: string[];
  widths: number[];
  floors: number[];
  at: number;
}

// Under fitColumns the widths always add up to the viewport, so dragging one
// edge is a trade: the columns before it keep their widths, the dragged one
// takes the pointer, and the ones after it share the difference in
// proportion (never below their floors). The last column trades with the
// ones before it instead. Every width is written back, so the layout renders
// exactly these and the edge stays under the pointer.
export function fitResize(f: FitDrag, want: number): WidthMap {
  const n = f.keys.length;
  const side = f.at < n - 1 ? 'after' : 'before';
  const absorb = f.widths.flatMap((_, j) => ((side === 'after' ? j > f.at : j < f.at) ? [j] : []));
  const room = f.widths.reduce((a, w, j) => a + (absorb.includes(j) || j === f.at ? w : 0), 0);
  const minAbsorb = absorb.reduce((a, j) => a + f.floors[j], 0);
  const R = Math.max(f.floors[f.at], Math.min(want, room - minAbsorb));
  const share = absorb.reduce((a, j) => a + f.widths[j], 0);
  const out: WidthMap = {};
  f.keys.forEach((k, j) => {
    if (j === f.at) out[k] = R;
    else if (absorb.includes(j)) out[k] = Math.max(f.floors[j], Math.round((f.widths[j] * (room - R)) / share));
    else out[k] = f.widths[j];
  });
  return out;
}
