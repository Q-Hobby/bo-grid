// The <Grid> component's props. Kept out of Grid.svelte so the component
// reads as logic; the public type is `GridProps` (ComponentProps of Grid).
import type { Snippet } from 'svelte';
import type { AggKind } from './aggregate';
import type { GridApi, ViewportRange } from './api';
import type { DefaultColumn } from './celltype';
import type { CellEditEvent, CellTypeDef, ColumnDef, GridRow, SortState } from './column';
import type { AnyFilter, FilterTypes } from './filtering';
import type { LazyGroup } from './grouping';
import type { GridLabels } from './labels';
import type { RowSource } from './source';
import type { GridTheme } from './theme';

export interface GridPropsDef {
  rows: GridRow[];
  columns: ColumnDef[];
  /** Viewport height. A **number** is the scroll viewport's pixel height (the
      grid's total height is that plus header/toolbar/footer chrome). A **CSS
      string** (e.g. `'100%'`, `'80vh'`, `'480px'`) sizes the whole grid element
      and the viewport auto-fits the space left after the chrome — give the grid
      a sized parent (or use `'100%'` inside a flex/grid cell). */
  height: number | string;
  /** Row height in px (uniform), or a function for variable heights
      (in-memory mode only). Default 36. */
  rowHeight?: number | ((row: GridRow, index: number) => number);
  /** Built-in theme name or a custom token map. Default 'dark'. */
  theme?: 'dark' | 'light' | GridTheme;
  /** Allow drag-to-resize column widths. Default true; opt out per column
      with `resizable: false`. */
  resizable?: boolean;
  /** Highlight cells/ranges on click-drag (the blue selection fill + focus
      ring + fill handle). Set false for a read-only/display grid where clicks
      should pass straight through to `onRowClick`/`onCellClick` without a
      selection highlight. Default true. */
  cellSelection?: boolean;
  /** Show a leading checkbox column for whole-row selection (keyed by row id,
      stable across sort/filter). Default false. */
  rowSelection?: boolean;
  /** Called with the selected row ids whenever the row-selection set changes. */
  onRowSelectionChange?: (selectedIds: Array<string | number>) => void;
  /** Column keys to hide (controlled). Build your own column-picker UI and
      drive this prop — the grid stays presentation-only. Composed (union) with
      columns the user hides at runtime via the column menu. */
  hiddenColumns?: string[];
  /** Called with all currently-hidden column keys whenever the runtime set
      changes (column menu hide/show). */
  onColumnVisibilityChange?: (hidden: string[]) => void;
  /** Enable a per-column header menu (a ⋮ trigger) with sort, hide and (with
      `filterMenu`) filter actions. Default false. */
  columnMenu?: boolean;
  /** Show a "Columns" button that opens a panel to toggle column visibility
      (the place to restore columns hidden via the menu). Lazy-loaded. Default
      false. */
  columnsPanel?: boolean;
  /** Render only the columns within the horizontal scroll window (+ overscan)
      for very wide grids (100+ columns). Forces fixed-width horizontal scroll;
      pinned columns always render. Default false (fit-to-width). */
  virtualizeColumns?: boolean;
  /** Return extra CSS class(es) for a data row (e.g. to colour by value).
      Style them via `:global(.your-class)` since rows live inside the grid. */
  rowClass?: (row: GridRow) => string | undefined;
  /** Identity key for row selection. Defaults to `row.id`; override for
      string/UUID/composite keys. */
  getRowId?: (row: GridRow) => string | number;
  /** Controlled "active row" highlight (keyed by `getRowId`) — for
      master-detail / list-detail where one row is selected. Independent of the
      checkbox `rowSelection` and the cell range selection. `null` = none. */
  selectedRowId?: string | number | null;
  /** Called when a data row is activated by click or Enter (open a detail
      view, navigate, …). Edit-input and checkbox clicks are excluded. */
  onRowClick?: (row: GridRow, event: MouseEvent | KeyboardEvent) => void;
  /** Controlled sort order (multi-key, primary first). When set, the grid
      reflects this and reports changes via `onSortChange` instead of holding
      its own state. Omit for uncontrolled sorting. */
  sort?: SortState[];
  /** Called with the new sort order whenever a header is clicked. */
  onSortChange?: (sort: SortState[]) => void;
  /** Controlled column filters (keyed by column key). When set, the grid
      reflects these and reports changes via `onFilterChange` instead of holding
      its own. Omit for uncontrolled filtering. */
  columnFilters?: Record<string, AnyFilter>;
  /** Called with the full column-filter map whenever a header filter changes. */
  onFilterChange?: (filters: Record<string, AnyFilter>) => void;
  /** Show a pinned totals row: each column with a `groupAgg` shows that
      aggregate over all (filtered) rows. In-memory mode only. Default false. */
  footer?: boolean;
  /** Called when a cell is clicked, with its row, column and value. Fires in
      addition to `onRowClick`; excluded for the edit input. */
  onCellClick?: (
    info: { row: GridRow; column: ColumnDef; value: unknown },
    event: MouseEvent,
  ) => void;
  /** Rows pinned to the top, always visible above the scroll (a benchmark, a
      summary, "your position"). Display-only — not virtualized or selectable.
      Their `getRowId` must not collide with a row in `rows`/`source` — with a
      derived-flash column (`flash: 'auto'`), a shared id means the pinned
      cell and the data-row cell share one flash-tracker entry, so updating
      one can suppress or trigger a flash on the other. To let users pin rows
      of `rows` themselves, use `rowPinning`. */
  pinnedRows?: GridRow[];
  /** Show a per-column filter input row under the header. Rows must match every
      non-empty column filter (AND). In-memory mode only. Default false. */
  filterRow?: boolean;
  /** Enable a per-column header filter menu (lazy-loaded on first open). Each
      filterable column shows a funnel; the menu's control matches the column
      type (text/number/date). Override or disable per column with `col.filter`.
      Works in source mode too (filters are delegated to the `RowSource`); set
      filters need in-memory data. Default false. */
  filterMenu?: boolean;
  /** Show a built-in quick-filter search box above the grid that matches across
      all column values (ANDed with the `filter` prop). In-memory mode only.
      Default false. */
  quickFilter?: boolean;
  /** Show an Excel-style fill handle at the selection's bottom-right corner;
      drag it to copy the selected value(s) across the extended range (editable
      columns only). In-memory mode only. Default false. */
  fillHandle?: boolean;
  /** Message shown when there are no rows. Defaults to `labels.noRows`. */
  emptyMessage?: string;
  /** Override any string the grid renders itself (menus, filter editor,
      pager, aria labels). Merged over English defaults — pass only what
      changes. Interpolated entries are functions so translations can reorder
      the parts. Resolved per grid. */
  labels?: Partial<GridLabels>;
  /** Reusable column types, by name. A column with `cellType: 'name'` gets
      that entry's defaults (format, compare, align, filter, width, a
      `component` renderer…) under its own fields, and the built-in type
      named by `extends` for sorting, filtering and export. */
  /** Settings applied under every column — its own fields (and a registered
      `cellType`) win. */
  defaultColumn?: DefaultColumn;
  cellTypes?: Record<string, CellTypeDef>;
  /** Custom filter kinds, by name. A column selects one with `filter: 'name'`;
      the header filter menu draws its `component` and the view keeps rows
      for which `test` passes. An unregistered kind filters nothing. */
  filterTypes?: FilterTypes;
  /** BCP 47 locale for the grid's own number formatting (aggregation bar,
      pager row count). Default: the runtime's locale. */
  locale?: string;
  /** Called once, when the grid mounts, with a handle for imperative actions:
      `scrollToRow`, `focusCell`, `getSelectedRows`, `autosizeColumns`, `exportCSV`,
      `getState` / `applyState`. */
  onReady?: (api: GridApi) => void;
  /** Called with the data rows on screen — the rows in view plus the small
      buffer rendered around them — whenever that set changes (scroll, sort,
      filter, new data), never for a tick that only changes values. Pass it
      `createViewportSubscriptions(...).update` from `bo-grid/realtime` to
      stream just the symbols in view. */
  onViewportChange?: (view: ViewportRange) => void;
  /** How a flash plays. `'fade'` (default): the tint fades out. `'hold'`: the
      tint holds for the flash window, then drops — no CSS animation, so a busy
      board restyles and repaints a flashing cell twice instead of every frame.
      `'auto'`: fade while few cells flash at once, hold when many do. A flash
      that lights whole rows (`flashNewRows`, `api.flashCells`) counts each
      cell it lights. */
  flashMotion?: 'fade' | 'hold' | 'auto';
  /** Keep the sort and filters current while `api.patchRows` changes values in
      place. When a patch changes a field the grid sorts or filters by, the
      rows it changed are merged back into place at most every `liveSort` ms
      (`true`: 500), instead of the whole view being re-sorted. The selection
      stays on the same rows; nothing moves while a cell is being edited. Off
      by default: rows hold their place until `api.refresh()`. It follows
      `patchRows`; values written into rows any other way still need
      `api.refresh()`. */
  liveSort?: boolean | number;
  /** While the pointer is over the rows, `liveSort` waits, so a row does not
      move just as it is clicked; the rows re-sort once the pointer leaves (or
      the window loses focus, or the tab is hidden). Mouse and pen only.
      Default true; set false for a screen nobody points at. */
  pauseOnHover?: boolean;
  /** Dim a row when nothing new has come for it for this many ms: a quote
      whose feed went quiet. News is a patch (`api.patchRows`) that changed
      the row, or a new object for it in `rows` (the row arrived, or a copy
      replaced it); a patch that re-sends the values the row already has is
      not. The row comes back the moment it ticks. Rows already there count
      from mount, or from when `staleAfter` is turned on. Dimmed with
      `opacity: var(--bo-stale-opacity, 0.5)`. Off by default. */
  staleAfter?: number;
  /** Flash a row once when it arrives in `rows` (a new order, a new fill):
      every cell, in the neutral flash colour, for this many ms (`true`: 600).
      A row arrives when its id is new; a copy of a row already there does not
      flash, nor do the rows an empty grid gets (a load or a reload), nor a
      wholesale replacement (more than 64 rows, and more than an eighth of
      them, at once). Rows on
      screen only, as with every flash. Off by default. */
  flashNewRows?: boolean | number;
  /** Highlight the column under the pointer (body and header) — handy on a
      wide board. One overlay for the whole column, not a class per cell. */
  columnHover?: boolean;
  /** A leading row-number column (1, 2, 3… in view order; data rows only), as
      in a spreadsheet. Its cells are row headers, so screen readers announce
      the number with each row. */
  rowNumbers?: boolean;
  /** Let users pin rows above the scroll from the row menu (right-click):
      "Pin to top" / "Unpin". A pinned row stays in the body too, keeps
      updating, and is remembered with `persistKey` and in `getState()`. */
  rowPinning?: boolean;
  /** Ctrl/⌘+F in the grid opens a find bar: it matches the cells' displayed
      text (case-insensitive) and steps through matches with Enter /
      Shift+Enter, focusing and scrolling to each. Escape closes it. Off by
      default, as it takes Ctrl+F from the browser while the grid has focus.
      In-memory rows only. */
  findBar?: boolean;
  /** Scale every column with the grid, in proportion to its `width`, instead
      of only `flex` columns taking up the change: the grid stays responsive
      without hand-tuned flex weights. A column never gets narrower than its
      `minWidth` (64 px, or its own width if smaller, without one) nor wider
      than its `maxWidth`; when the floors no longer fit, the grid scrolls
      sideways. Dragging a column edge still follows the pointer. */
  fitColumns?: boolean;
  /** Called with the pinned row ids (in pin order) whenever they change. */
  onRowPinChange?: (ids: (string | number)[]) => void;
  /** Show a loading overlay over the grid (for consumer-driven async work in
      in-memory mode; source mode shows skeleton rows automatically). */
  loading?: boolean;
  /** Right-click row menu. Return the items for a row; an empty array shows no
      menu. Each item runs `onSelect` and closes the menu. */
  rowMenu?: (row: GridRow) => Array<{ label: string; onSelect: () => void }>;
  /** Master-detail: render an expandable detail panel under a row. Adds a
      leading expand-toggle column. In-memory mode only (overrides rowHeight). */
  detail?: Snippet<[{ row: GridRow }]>;
  /** Height (px) of the expanded detail panel. Default 160. */
  detailHeight?: number;
  /** Tree data: return a row's children (undefined/empty = leaf). When set,
      `rows` are the roots; the grid renders an indented, expandable tree.
      In-memory mode; filter/sort/group/paginate are not applied to the tree. */
  getChildren?: (row: GridRow) => GridRow[] | undefined;
  /** Async tree data: load a row's children on expand (server-backed trees).
      Returns a promise; the grid shows a loading row, then caches the result.
      Pair with `hasChildren` (a cheap predicate) so chevrons show without
      loading. Use instead of `getChildren`. In-memory roots. */
  loadChildren?: (row: GridRow) => Promise<GridRow[]>;
  /** Cheap predicate for whether a row has children (drives the expand chevron
      without loading). Required with `loadChildren`; optional with `getChildren`. */
  hasChildren?: (row: GridRow) => boolean;
  /** Server-side grouping: top-level group summaries (header data, no leaf rows).
      Each group's rows load on expand via `loadGroup`. In-memory mode. */
  lazyGroups?: LazyGroup[];
  /** Load a lazy group's leaf rows on expand (returns a promise; shows a loading
      row, then caches). Required with `lazyGroups`. */
  loadGroup?: (key: string) => Promise<GridRow[]>;
  /** Enable drag-to-reorder rows via a handle in the first column. Called with
      the from/to indices (into the visible rows) on drop — reorder your own
      `rows` in here. Flat, unsorted, in-memory lists only. */
  onRowReorder?: (fromIndex: number, toIndex: number) => void;
  /** Rows per page. When > 0 (in-memory mode), shows a pager instead of one
      long scroll; rows still virtualize within a page. Default 0 (off). */
  pageSize?: number;
  /** Page-size choices for a dropdown in the pager (e.g. `[25, 50, 100]`).
      Picking one re-pages from page 0. Uncontrolled unless you also drive
      `pageSize` and update it from `onPageSizeChange`. */
  pageSizeOptions?: number[];
  /** Called with the new page size when the pager's size dropdown changes. */
  onPageSizeChange?: (size: number) => void;
  /** Controlled current page (0-based). Omit for uncontrolled paging. */
  page?: number;
  /** Called with the new page index when the pager is used. */
  onPageChange?: (page: number) => void;
  /** Called with the new column-key order after a header drag-reorder. */
  onColumnReorder?: (keys: string[]) => void;
  /** Called with a column key + new width after a drag-resize. */
  onColumnResize?: (key: string, width: number) => void;
  /** Accessible name for the grid (`aria-label` on the `role="grid"` root). */
  ariaLabel?: string;
  filter?: string;
  groupBy?: string[];
  aggregations?: AggKind[];
  persistKey?: string;
  /** Back the grid with a windowed/server data source instead of `rows`.
      In source mode, sort + filter are delegated to the source; grouping is
      not applied. */
  source?: RowSource;
  /** Called when an editable cell is committed. Update your row data in here. */
  onCellEdit?: (e: CellEditEvent) => void;
  /** Render content for `type: 'custom'` columns. */
  cell?: Snippet<[{ row: GridRow; column: ColumnDef; value: unknown }]>;
}
