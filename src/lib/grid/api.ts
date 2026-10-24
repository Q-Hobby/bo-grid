import type { ColumnDef, GridRow } from './column';
import type { GridState } from './state';

export type ScrollAlign = 'start' | 'center' | 'end' | 'nearest';

/** The data rows the grid has on screen, reported by `onViewportChange`:
    the rows in view plus the small buffer rendered above and below them, in
    view order. Group, loading and pinned rows are not included. */
export interface ViewportRange {
  /** Visual index of the first reported row; -1 when no data row is on screen. */
  first: number;
  /** Visual index of the last reported row; -1 when no data row is on screen. */
  last: number;
  rows: GridRow[];
}

/** What `api.flashCells` flashes, and how. */
export interface FlashCellsOptions {
  /** Row ids; every rendered row when omitted. */
  rows?: Iterable<string | number>;
  /** Column keys; every column when omitted. */
  columns?: Iterable<string>;
  /** Tint like a rise or a fall; the neutral amber when omitted. */
  dir?: 'up' | 'down';
  /** Duration in ms; each column's `flashMs` (else 300) when omitted. */
  ms?: number;
}

/** The handle `onReady` hands out: things that are actions, not state. Each
    method's `@example` assumes `api` holds it (`onReady={(a) => (api = a)}`). */
export interface GridApi {
  /** Scroll a row into view by its id; `align` is `'nearest'` unless given.
      Returns false when the row is not in the current view (filtered out,
      not loaded, or unknown).
      @example
      api.scrollToRow(order.id, 'center'); */
  scrollToRow(key: string | number, align?: ScrollAlign): boolean;
  /** Focus (and select) one cell by row id and column key. Returns false when
      the row or column is not currently visible.
      @example
      if (!api.focusCell(row.id, 'qty')) api.scrollToRow(row.id); */
  focusCell(rowKey: string | number, columnKey: string): boolean;
  /** The focused cell's row and column, or null when no data cell has focus
      (nothing focused yet, or the focus is on a group row). For hotkeys that
      act on the row the user is on.
      @example
      const cell = api.getFocusedCell();
      if (cell) openTicket(cell.row); */
  getFocusedCell(): { row: GridRow; column: ColumnDef } | null;
  /** Ticked rows (needs `rowSelection`), in view order.
      @example
      const ids = api.getSelectedRows().map((row) => row.id); */
  getSelectedRows(): GridRow[];
  /** Fit columns to their content, as the column menu's Autosize does. All
      resizable columns when `keys` is omitted. The other columns keep their
      widths (flex ones are held where they are).
      @example
      api.autosizeColumns(['sym', 'name']); */
  autosizeColumns(keys?: string[]): void;
  /** Download the current view (after filter and sort) as CSV, named
      `export.csv` unless `filename` is given.
      @example
      await api.exportCSV(`orders-${new Date().toISOString().slice(0, 10)}.csv`); */
  exportCSV(filename?: string): Promise<void>;
  /** Snapshot of the user's layout: order, widths, hidden, pins, sorts, filters.
      A plain object, safe to `JSON.stringify` and store.
      @example
      localStorage.setItem('orders-layout', JSON.stringify(api.getState())); */
  getState(): GridState;
  /** Restore a snapshot, reconciled against the columns as they are now.
      Returns false when the state is unusable (foreign version, not an object).
      @example
      const saved = localStorage.getItem('orders-layout');
      if (saved) api.applyState(JSON.parse(saved)); */
  applyState(state: unknown): boolean;
  /** Realtime fast path: write `[rowId, fields]` patches into the rows in
      place and repaint only the rendered rows they change. Rows may be plain
      objects (no $state proxy) — far cheaper per write in a busy feed. Feed it
      a tick stream: `createTickStream({ apply: (b) => api.patchRows(b) })`.
      Sort and filter catch up on the next view change, as for any live data
      (or at once, with `liveSort`). A patch's id is the row's `getRowId`
      value (`row.id` unless set). Returns how many rows changed.
      @example
      api.patchRows([
        [1, { last: 68.6, vol: 1_204_300 }],
        [2, { last: 121.1 }],
      ]); */
  patchRows(patches: Iterable<readonly [string | number, Record<string, unknown>]>): number;
  /** Re-run filter and sort against the rows' current values. Values that
      change in place (a feed) never re-sort the view by themselves — that would
      mean re-sorting on every tick — so call this when the order should catch
      up, e.g. every second on a "top movers" board (or use `liveSort`).
      @example
      const timer = setInterval(() => api.refresh(), 1000); */
  refresh(): void;
  /** Flash cells on demand — a fill, an alert, a row to notice — with the
      tick animation, whether or not their values changed. Only rows on screen
      flash. Value cells flash (numbers, text); cells that draw their own
      content (badges, sparklines, components) do not. Returns how many rows
      it flashed.
      @example
      api.flashCells({ rows: [fill.orderId], dir: fill.side === 'buy' ? 'up' : 'down', ms: 800 }); */
  flashCells(opts?: FlashCellsOptions): number;
  /** Pin a row above the scroll (or unpin it with `pinned: false`), as the
      row menu does under `rowPinning`; `pinned` is true unless given. The row
      stays in the body too. Returns false when no row has that id.
      @example
      api.pinRow(row.id); */
  pinRow(key: string | number, pinned?: boolean): boolean;
  /** Ids of the rows pinned at runtime, in pin order.
      @example
      for (const id of api.getPinnedRowIds()) api.pinRow(id, false); */
  getPinnedRowIds(): (string | number)[];
  /** Open the find bar (`findBar`), optionally searching for `query` at once.
      @example
      api.openFind('VNM'); */
  openFind(query?: string): void;
}

/** The `scrollTop` that brings a row of `rowH` at `rowTop` into a viewport of
    `viewH` currently scrolled to `viewTop`. Never negative. */
export function scrollTopFor(
  align: ScrollAlign,
  rowTop: number,
  rowH: number,
  viewTop: number,
  viewH: number,
): number {
  let target: number;
  switch (align) {
    case 'start':
      target = rowTop;
      break;
    case 'end':
      target = rowTop + rowH - viewH;
      break;
    case 'center':
      target = rowTop + rowH / 2 - viewH / 2;
      break;
    default:
      if (rowTop < viewTop) target = rowTop;
      else if (rowTop + rowH > viewTop + viewH) target = rowTop + rowH - viewH;
      else target = viewTop;
  }
  return Math.max(0, target);
}
