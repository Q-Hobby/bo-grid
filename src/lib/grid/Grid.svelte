<script module lang="ts">
  // Per-instance id counter, for stable ARIA ids (active-descendant).
  let uid = 0;
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import type { ColumnDef, GridRow, SortState, SortDir } from './column';
  import { colStyle, baseWidth, MIN_FLEX_W, isNumeric, alignOf, isSortable, isEditable, sortRows, formatCell, cellValue } from './column';
  import { arrangePinned } from './pin';
  import { columnWindow, columnOffsets } from './colvirt';
  import { uniformHeights, variableHeights } from './rowheight';
  import { themeVars, lightTheme } from './theme';
  import { Selection } from './selection.svelte';
  import { aggregate, type AggResult } from './aggregate';
  import { buildFlatRows, buildLazyGroupRows, activeGroupsAt, type VisualRow, type GroupNode } from './grouping';
  import { buildTreeRows } from './tree';
  import { FlashTracker, FlashClock, FlashLoad } from './flash';
  import { parseClipboard, copyText, pastePlan, fillExtent, fillPlan } from './clipboard';
  import { applyWidths, applyAutoWidths, clampWidth, contentWidth, fitResize, isResizable, type FitDrag } from './sizing';
  import {
    passesFilters,
    isFilterActive,
    isBuiltinFilter,
    defaultFilterKind,
    distinctValues,
    type AnyFilter,
  } from './filtering';
  import { RowSourceController } from './source.svelte';
  import Cell from './Cell.svelte';
  import GroupRow from './GroupRow.svelte';
  import AggregationBar from './AggregationBar.svelte';
  import Pager from './Pager.svelte';
  import RowMenu from './RowMenu.svelte';
  import { resolveLabels } from './labels';
  import { resolveColumns } from './celltype';
  import { parseCellInput } from './edit';
  import { dataOrdinals, rowNumberWidth } from './rownumbers';
  import { scrollTopFor, type FlashCellsOptions, type ScrollAlign, type ViewportRange } from './api';
  import { buildMergePlan, combinedFlex, type MergePlan, type SpanRun } from './merge';
  import { GRID_STATE_VERSION, reconcileState, type GridState } from './state';
  import type { GridPropsDef } from './props';
  import { createEditHistory } from './history';
  import { createLiveRows } from './live.svelte';
  import { createColumnState } from './columns.svelte';
  import { dismissOnOutside } from './dismiss';
  import { createRowState } from './rowstate.svelte';
  import { keyAction, type KeyState } from './keyboard';
  import { TextMeter } from './textmeter';

  let {
    rows = [],
    columns: columnsIn = [],
    defaultColumn,
    cellTypes,
    filterTypes,
    height,
    filter = '',
    groupBy = [],
    aggregations = ['sum', 'avg', 'count', 'min', 'max'],
    persistKey,
    source,
    onCellEdit,
    rowHeight,
    theme,
    resizable = true,
    cellSelection = true,
    rowSelection = false,
    onRowSelectionChange,
    hiddenColumns = [],
    onColumnVisibilityChange,
    columnMenu = false,
    columnsPanel = false,
    virtualizeColumns = false,
    rowClass,
    getRowId = (r: GridRow) => r.id,
    selectedRowId = null,
    onRowClick,
    sort,
    onSortChange,
    columnFilters,
    onFilterChange,
    footer = false,
    onCellClick,
    pinnedRows = [],
    filterRow = false,
    filterMenu = false,
    quickFilter = false,
    fillHandle = false,
    emptyMessage,
    labels,
    locale,
    onReady,
    onViewportChange,
    flashMotion = 'fade',
    columnHover = false,
    rowNumbers = false,
    rowPinning = false,
    findBar = false,
    fitColumns = false,
    onRowPinChange,
    loading = false,
    rowMenu,
    detail,
    detailHeight = 160,
    getChildren,
    loadChildren,
    hasChildren,
    lazyGroups,
    loadGroup,
    onRowReorder,
    pageSize = 0,
    pageSizeOptions,
    onPageSizeChange,
    page,
    onPageChange,
    onColumnReorder,
    onColumnResize,
    ariaLabel,
    cell,
  }: GridPropsDef = $props();

  // Registered cell types and the grid locale, resolved once — every read of
  // `columns` below sees plain built-in column types.
  const columns = $derived(resolveColumns(columnsIn, cellTypes, locale, defaultColumn));

  const ROW_H = 36;
  const OVERSCAN = 6;
  const gid = `bo-grid-${uid++}`;
  const L = $derived(resolveLabels(labels));

  let scrollTop = $state(0);
  // Styled floating tooltip (opt-in via column `tooltip`): a single fixed-
  // position bubble driven by the hovered cell's `data-bo-tip`. Fixed escapes
  // the cell/viewport overflow:hidden without a portal.
  const hasTooltips = $derived(columns.some((c) => !!c.tooltip || !!c.headerTooltip));
  let tip = $state<{ x: number; y: number; text: string; below: boolean } | null>(null);
  // Sort order, primary first. Empty = unsorted. Multiple keys via Shift-click.
  // Controlled by the `sort` prop when provided, else internal state.
  let internalSorts = $state<SortState[]>([]);
  const sorts = $derived(sort ?? internalSorts);
  function setSorts(next: SortState[]): void {
    if (sort === undefined) internalSorts = next; // uncontrolled: own the state
    onSortChange?.(next); // always notify (lets consumers observe/persist)
  }
  let gridEl: HTMLDivElement;
  let viewportEl: HTMLDivElement;
  let headEl: HTMLDivElement;
  let filterRowEl = $state<HTMLDivElement>();
  let groupHeadEl = $state<HTMLDivElement>();

  const sel = new Selection();
  let dragging = $state(false);
  // Fill handle: drag the selection's corner to copy its value(s) across.
  let filling = $state(false);
  let fillTo = $state<{ r: number; c: number } | null>(null);
  let fillSource: { r0: number; c0: number; r1: number; c1: number } | null = null;
  let editing = $state<{ r: number; c: number } | null>(null);
  // When editing was opened by typing a character (type-to-edit), the editor
  // seeds its input with it; null means edit the existing value (dblclick/Enter).
  let editSeed = $state<string | null>(null);

  function startEdit(r: number, c: number, seed: string | null = null) {
    if (!isEditable(cols[c]) || !dataAt(r) || isMerged(r, c)) return;
    editSeed = seed;
    editing = { r, c };
  }
  // ---- Edit history (undo / redo, history.ts) --------------------------------
  // Undo re-emits onCellEdit with the old value; paste and fill record as one
  // step (history.batch).
  const history = createEditHistory<GridRow, ColumnDef>();

  // Parse a raw string for cell (r,c) and write it. Shared by the built-in
  // inline editor, paste and fill. False when rejected (not editable, missing
  // row, unparseable, or refused by `validate`).
  function writeCell(r: number, c: number, raw: string): boolean {
    const col = cols[c];
    const row = dataAt(r);
    if (!col || !row || !isEditable(col)) return false;
    const parsed = parseCellInput(col, raw, row);
    return parsed.ok && writeValue(r, c, parsed.value);
  }
  // Validate an already-typed value, emit onCellEdit and record it for undo.
  function writeValue(r: number, c: number, value: unknown): boolean {
    const col = cols[c];
    const row = dataAt(r);
    if (!col || !row || !isEditable(col)) return false;
    if (col.validate && !col.validate(value, row)) return false; // consumer rejected it
    const old = row[col.key] ?? '';
    onCellEdit?.({ row, column: col, value });
    if (onCellEdit) history.record({ row, col, old, value });
    return true;
  }
  function undo(): void {
    const group = history.undo();
    if (!group) return;
    for (const e of group) onCellEdit?.({ row: e.row, column: e.col, value: e.old });
    editing = null;
  }
  function redo(): void {
    const group = history.redo();
    if (!group) return;
    for (const e of group) onCellEdit?.({ row: e.row, column: e.col, value: e.value });
    editing = null;
  }

  function commitEdit(r: number, c: number, raw: string) {
    editing = null;
    editSeed = null;
    writeCell(r, c, raw);
  }
  // A custom editor's typed value: no parsing, still validated.
  function commitValue(r: number, c: number, value: unknown) {
    editing = null;
    editSeed = null;
    writeValue(r, c, value);
  }

  // Per-row state (rowstate.svelte.ts): selection, collapsed groups, expanded
  // rows and their loaded children, rows pinned above the scroll.
  const rowState = createRowState(() => persistKey);

  // Runtime column state (columns.svelte.ts): order, widths, autoWidth
  // measurements, and columns hidden or pinned from the column menu.
  const colState = createColumnState(() => persistKey, () => columns);
  let dragSrc = $state(-1);
  let dragOver = $state(-1);

  // Per-column filter text (filterRow), keyed by column key.
  let colFilters = $state<Record<string, string>>({});

  // Structured per-column filters from the header filter menu (v0.3), keyed by
  // column key. Menu filters take precedence over the filterRow text inputs.
  // Controlled by the `columnFilters` prop when provided, else internal state.
  let internalColumnFilters = $state<Record<string, AnyFilter>>({});
  const activeColumnFilters = $derived(columnFilters ?? internalColumnFilters);
  function setColumnFilters(next: Record<string, AnyFilter>): void {
    if (columnFilters === undefined) internalColumnFilters = next; // uncontrolled: own it
    onFilterChange?.(next); // always notify
  }

  // Built-in quick-filter text (global, matches across all columns).
  let quickText = $state('');

  const SEL_W = 40; // checkbox column width (px)
  const EXP_W = 30; // master-detail expand column width (px)
  // Master-detail expansion (opt-in via `detail`), keyed by row id.
  const expandable = $derived(!!detail && !source);

  // Leading fixed columns: row number (if any), expand toggle (if any), then
  // checkbox (if any).
  const numOffset = $derived(rowNumbers ? 1 : 0);
  const selOffset = $derived(rowSelection ? 1 : 0);
  const expOffset = $derived(expandable ? 1 : 0);
  // Read lazily: rowCount is declared further down, with the row model.
  const numW = $derived.by(() => (rowNumbers ? rowNumberWidth(rowCount) : 0));
  const leadCols = $derived(numOffset + selOffset + expOffset); // count, for aria indices
  const leadPx = $derived(numW + selOffset * SEL_W + expOffset * EXP_W); // px, for sticky offsets

  const isExpanded = (id: string | number): boolean => rowState.isExpanded(id);
  const toggleExpand = (id: string | number): void => rowState.toggleExpanded(id);
  // Expand/collapse a tree node or a server-side group, loading its rows on
  // the first expand.
  function toggleTreeNode(row: GridRow): void {
    rowState.toggleLoaded(getRowId(row), loadChildren ? () => loadChildren(row) : undefined);
  }
  function toggleLazyGroup(key: string): void {
    rowState.toggleLoaded(key, loadGroup ? () => loadGroup(key) : undefined);
  }

  const isRowSelected = (id: string | number): boolean => rowState.isSelected(id);
  function toggleRow(id: string | number): void {
    rowState.toggleSelected(id);
    onRowSelectionChange?.(rowState.selectedIds());
  }

  const ordered = $derived(
    colState.order.length === columns.length ? colState.order.map((i) => columns[i]) : columns,
  );
  // Columns hidden at runtime via the column menu, unioned with the controlled
  // `hiddenColumns` prop.
  const effectiveHidden = $derived(
    colState.hidden.length ? [...new Set([...hiddenColumns, ...colState.hidden])] : hiddenColumns,
  );
  // Drop hidden columns. Applied after ordering so `order` stays indexed over the
  // full column set.
  const visible = $derived(
    effectiveHidden.length ? ordered.filter((c) => !effectiveHidden.includes(c.key)) : ordered,
  );
  // Apply any resize overrides (turns the dragged column fixed-width), then
  // pin-arrange. Both are no-ops by default, so the grid stays fit-to-width.
  // autoWidth: content widths measured on screen (grow-only, not persisted),
  // layered under the user's own widths.
  const sized = $derived(
    applyAutoWidths(applyWidths(visible, colState.widths), colState.autoMeasured, colState.widths),
  );
  // Runtime pin overrides (column menu) layered on top of static `col.pinned`.
  const pinnedSized = $derived.by(() => {
    const pins = colState.pins;
    return Object.keys(pins).length ? sized.map((c) => (c.key in pins ? { ...c, pinned: pins[c.key] } : c)) : sized;
  });
  // Derived flash keeps its last-seen value per (row id, column key) — a cell
  // can't hold it, because the row loop is keyed by visual index and recycles
  // mounted cells across rows as you scroll.
  //
  // Deliberately NOT $derived: a derived tracker would be rebuilt whenever
  // `columns` changed identity (an inline array literal does that on every
  // parent render), and a fresh tracker sees every cell as first-sight, which
  // silently means nothing ever flashes. One stable instance per grid — an empty
  // Map until a column with derived flash actually observes through it.
  const flashTracker = new FlashTracker();

  // `flashMotion: 'hold'`: a held flash is a static tint, not a CSS animation —
  // a running animation is restyled and repainted every frame, which is most of
  // a busy board's frame; a held tint changes only when it starts and when it
  // drops. Cells holding a tint read `flashNow` and drop it once their window
  // has passed; the clock ticks only while some cell holds one.
  // `holds` is asked once per flash, as it starts (by the tracker, on a real
  // change): always under `'hold'`; under `'auto'`, fade while few overlap and
  // hold when many do (FlashLoad).
  let flashNow = $state(0);
  const holdClock = new FlashClock((now) => (flashNow = now));
  const flashLoad = new FlashLoad();
  const flashHold = {
    clock: () => flashNow,
    until: (t: number) => holdClock.until(t),
    holds: (at: number) => flashMotion !== 'auto' || flashLoad.start(at),
  };
  $effect(() => () => holdClock.stop());

  // Pin-arrangement: pinned columns move to the edges and get sticky offsets.
  // When nothing is pinned this is a no-op and the grid stays fit-to-width.
  let viewW = $state(0);
  // In fixed-width mode (pinned columns or column virtualization) flex columns
  // grow to fill the viewport, so the grid never stops short of its right edge.
  // Columns that cannot fit the viewport switch the grid to horizontal scroll
  // instead of being clipped: fixed widths, plus a readable minimum for flex
  // columns (which would otherwise squeeze to nothing). The threshold is the
  // same base width the fixed-width layout starts from, so crossing it never
  // makes columns jump.
  // `fitColumns` sizes every column in JS (fitWidths) and shrinks them to
  // their floors before scrolling, so its threshold is the floors' sum.
  const fitFloor = (c: ColumnDef): number => c.minWidth ?? Math.min(baseWidth(c), MIN_FLEX_W);
  const overflowing = $derived(
    viewW > 0 && pinnedSized.reduce((a, c) => a + (fitColumns ? fitFloor(c) : baseWidth(c)), leadPx) > viewW,
  );
  const fixedWidths = $derived(fitColumns || virtualizeColumns || overflowing || pinnedSized.some((c) => !!c.pinned));
  const layout = $derived(
    arrangePinned(pinnedSized, fixedWidths && viewW ? viewW - leadPx : 0, fitColumns ? fitFloor : undefined),
  );
  const cols = $derived(layout.columns);
  const pinned = $derived(layout.anyPinned);
  // Fixed-width horizontal-scroll mode: when columns are pinned OR column
  // virtualization is on. Drives the same layout (explicit widths, overflow-x,
  // scroll-synced header) that pinning already uses.
  const hScroll = $derived(pinned || virtualizeColumns || overflowing);
  // Cells take the layout's pixel widths whenever it has computed them: in
  // horizontal-scroll mode, and under `fitColumns` (which never scrolls until
  // its floors no longer fit).
  const explicitWidths = $derived(hScroll || (fitColumns && viewW > 0));
  // Header rows scroll with the body in fixed-width mode, driven by the body's
  // scrollLeft. They need slack past their content to always reach it: Chrome
  // caps an overflow:hidden element's scroll range without subtracting its
  // reserved scrollbar gutter, and the body's offset can round up at the far
  // right (device-pixel snapping). The slack itself is never scrolled into view.
  const headRowStyle = $derived(hScroll ? 'padding-right:32px;' : '');

  // Column virtualization: render only the columns whose x-range intersects the
  // horizontal viewport (+ overscan); pinned columns always render. Off-window
  // runs of columns collapse into a single spacer so widths/positions are exact.
  const COL_OVERSCAN = 320; // px
  let scrollLeft = $state(0);
  // Viewport height in px for row virtualization. A numeric `height` is that
  // value directly; a CSS-string `height` (auto-fit) is the measured viewport
  // height (clientHeight), with a sane fallback before the first measure.
  const heightIsPx = $derived(typeof height === 'number');
  let viewH = $state(0);
  // Rows pinned above the scroll take the top of the viewport, so the body
  // shows `pinnedH` fewer pixels: virtualization and keep-in-view use that.
  // (Read lazily: topRows is declared with the row pinning state below; the
  // measured height outlives the area, so it only counts while there is one.)
  let pinnedH = $state(0);
  const pinnedPx = $derived.by(() => (topRows.length > 0 ? pinnedH : 0));
  const viewPx = $derived.by(() => Math.max(baseH, (heightIsPx ? (height as number) : viewH || 400) - pinnedPx));
  type ColItem = { kind: 'cell'; ci: number; key: string } | { kind: 'spacer'; w: number; key: string };
  const colItems = $derived.by<ColItem[]>(() => {
    const n = cols.length;
    // Off, or before the viewport width is measured: render every column.
    if (!virtualizeColumns || !viewW) {
      return Array.from({ length: n }, (_, ci) => ({ kind: 'cell', ci, key: 'c' + ci }) as ColItem);
    }
    const widths = layout.info.map((inf) => inf.width);
    const pins = layout.info.map((inf) => inf.pinned);
    let sp = 0;
    return columnWindow(columnOffsets(widths), widths, pins, scrollLeft, viewW, COL_OVERSCAN).map((it) =>
      it.kind === 'cell'
        ? ({ kind: 'cell', ci: it.ci, key: 'c' + it.ci } as ColItem)
        : ({ kind: 'spacer', w: it.w, key: 's' + sp++ } as ColItem),
    );
  });

  // Spanning header groups: consecutive columns sharing a `group` label merge
  // into one parent header cell (width = sum of child widths). null when unused.
  const headerGroups = $derived.by<{ label: string; width: number }[] | null>(() => {
    if (!cols.some((c) => c.group)) return null;
    const runs: { label: string; width: number }[] = [];
    for (let i = 0; i < cols.length; i++) {
      const label = cols[i].group ?? '';
      const w = layout.info[i].width;
      const last = runs[runs.length - 1];
      if (last && label !== '' && last.label === label) last.width += w;
      else runs.push({ label, width: w });
    }
    return runs;
  });

  // Theme → inline `--bo-grid-*` overrides. 'dark' uses the built-in defaults.
  const themeStyle = $derived(
    !theme || theme === 'dark' ? '' : themeVars(theme === 'light' ? lightTheme : theme),
  );

  // Screen readers track the active cell via aria-activedescendant (the focus
  // cell is always scrolled into view, so its element exists in the DOM).
  const activeId = $derived(sel.focus ? `${gid}-r${sel.focus.r}-c${sel.focus.c}` : undefined);

  // Pinned columns sit to the right of the (also-sticky) checkbox column, so
  // their sticky-left offsets shift by SEL_W when row selection is on.
  // Sticky position for a pinned column: left columns offset past the (also
  // sticky) checkbox column; right columns offset from the right edge.
  // `header`: the cell sits in a header row (column headers, header groups,
  // filter row) rather than in the body.
  function pinStick(ci: number, header = false): string {
    const inf = layout.info[ci];
    if (inf.side === 'right') return `position:sticky;right:${inf.right + (header ? headPinFix : bodyPinFix)}px;`;
    return `position:sticky;left:${inf.left + leadPx}px;`;
  }
  function headStyle(ci: number): string {
    if (!explicitWidths) return colStyle(cols[ci]);
    const inf = layout.info[ci];
    let s = `flex:0 0 ${inf.width}px;width:${inf.width}px;`;
    if (inf.pinned) s += `${pinStick(ci, true)}z-index:5;background:var(--bo-header-bg);`;
    return s;
  }
  function cellWidthStyle(ci: number, header = false): string {
    if (!explicitWidths) return colStyle(cols[ci]);
    const inf = layout.info[ci];
    let s = `flex:0 0 ${inf.width}px;width:${inf.width}px;`;
    if (inf.pinned) s += `${pinStick(ci, header)}z-index:2;background:var(--bo-bg);`;
    return s;
  }

  // Right-pinned cells stick to the right edge, but `position: sticky` resolves
  // that edge differently per container and browser: the header rows carry
  // scroll slack (padding-right), and Chrome counts a reserved but empty
  // scrollbar gutter as part of the sticky area. So measure where the last
  // right-pinned header and body cells actually end and correct their offsets
  // until both meet the body's content edge (just left of its scrollbar).
  // A sticky offset moves the cell linearly, so one measurement corrects it.
  let headPinFix = $state(0);
  let bodyPinFix = $state(0);
  const lastRightPin = $derived.by(() => {
    for (let ci = layout.info.length - 1; ci >= 0; ci--) {
      if (layout.info[ci].pinned && layout.info[ci].side === 'right') return ci;
    }
    return -1;
  });
  $effect(() => {
    const ci = lastRightPin;
    const head = headEl;
    const body = viewportEl;
    if (!hScroll || ci < 0 || !head || !body) {
      untrack(() => {
        headPinFix = 0;
        bodyPinFix = 0;
      });
      return;
    }
    // Re-measure whenever the geometry can move the edge or the cells.
    void [viewW, layout, leadCols, rowCount > 0];
    const colIndex = ci + 1 + leadCols;
    const edge = body.getBoundingClientRect().left + body.clientWidth;
    const correct = (fix: number, el: Element | null) => {
      if (!el) return fix;
      const next = fix - (edge - el.getBoundingClientRect().right);
      return Math.abs(next - fix) > 0.25 ? Math.round(next * 100) / 100 : fix;
    };
    untrack(() => {
      headPinFix = correct(headPinFix, head.querySelector(`[aria-colindex="${colIndex}"]`));
      bodyPinFix = correct(bodyPinFix, body.querySelector(`.row .c[aria-colindex="${colIndex}"]`));
    });
  });
  // The leading checkbox column: a fixed-width flex item, sticky-left (past the
  // expand column, if any) when the grid scrolls horizontally (pinned mode).
  function selCellStyle(header: boolean): string {
    let s = `flex:0 0 ${SEL_W}px;width:${SEL_W}px;`;
    if (hScroll)
      s += `position:sticky;left:${numW + expOffset * EXP_W}px;z-index:${header ? 6 : 2};background:var(--bo-${header ? 'header-bg' : 'bg'});`;
    return s;
  }
  // The leading expand-toggle column (master-detail), sticky past the row numbers.
  function expandCellStyle(header: boolean): string {
    let s = `flex:0 0 ${EXP_W}px;width:${EXP_W}px;`;
    if (hScroll)
      s += `position:sticky;left:${numW}px;z-index:${header ? 6 : 2};background:var(--bo-${header ? 'header-bg' : 'bg'});`;
    return s;
  }
  // The leading row-number column (`rowNumbers`), sticky at the far left.
  function numCellStyle(header: boolean): string {
    let s = `flex:0 0 ${numW}px;width:${numW}px;`;
    if (hScroll)
      s += `position:sticky;left:0;z-index:${header ? 6 : 2};background:var(--bo-${header ? 'header-bg' : 'bg'});`;
    return s;
  }

  // Windowed data source controller (only in source mode).
  const controller = $derived(source ? new RowSourceController(source) : null);

  function moveColumn(from: number, to: number) {
    colState.move(from, to);
    sel.clear();
    editing = null;
    onColumnReorder?.(colState.order.map((i) => columns[i].key));
  }

  // ---- Runtime column visibility (column menu) ------------------------------
  function setRuntimeHidden(next: string[]): void {
    colState.setHidden(next);
    onColumnVisibilityChange?.(effectiveHidden);
  }
  function hideColumn(key: string): void {
    if (!colState.hidden.includes(key)) setRuntimeHidden([...colState.hidden, key]);
  }
  function showColumn(key: string): void {
    if (colState.hidden.includes(key)) setRuntimeHidden(colState.hidden.filter((k) => k !== key));
  }
  function toggleColumnVisible(key: string): void {
    if (effectiveHidden.includes(key)) showColumn(key);
    else hideColumn(key);
  }
  function showAllColumns(): void {
    setRuntimeHidden([]);
  }
  // Columns tool panel (lazy-loaded checklist), anchored at the toolbar button.
  let ToolPanelComp = $state<typeof import('./ToolPanel.svelte').default | null>(null);
  let panelXY = $state<{ x: number; y: number } | null>(null);
  async function openToolPanel(e: Event) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!ToolPanelComp) ToolPanelComp = (await import('./ToolPanel.svelte')).default;
    panelXY = { x: rect.left, y: rect.bottom + 2 };
  }
  $effect(() => {
    if (panelXY) return dismissOnOutside(() => (panelXY = null));
  });

  // ---- Runtime row pinning (`rowPinning`) ------------------------------------
  // Ids pinned from the row menu or the API, in pin order (rowState.pinned).
  // The rows stay in the body; the area above the scroll shows them as well,
  // after any `pinnedRows`. Remembered with persistKey and carried by getState().
  function setPinnedIds(next: (string | number)[]): void {
    rowState.setPinned(next);
    onRowPinChange?.([...next]);
  }
  function pinRow(key: string | number, pin = true): boolean {
    if (!rowIndex.has(key)) return false;
    const ids = rowState.pinned;
    if (ids.includes(key) !== pin) setPinnedIds(pin ? [...ids, key] : ids.filter((k) => k !== key));
    return true;
  }
  const getPinnedRowIds = (): (string | number)[] => [...rowState.pinned];
  // The row menu's pin item, for rows of `rows` (not for `pinnedRows` extras).
  function rowPinItem(row: GridRow): { label: string; onSelect: () => void } | null {
    const key = getRowId(row);
    if (!rowIndex.has(key)) return null;
    const on = rowState.pinned.includes(key);
    return { label: on ? L.unpin : L.pinRow, onSelect: () => pinRow(key, !on) };
  }
  // Everything shown above the scroll: `pinnedRows`, then runtime pins whose
  // row is in the data now.
  const topRows = $derived.by((): GridRow[] => {
    const pinnedIds = rowState.pinned;
    if (pinnedIds.length === 0) return pinnedRows;
    const out = [...pinnedRows];
    const seen = new Set(pinnedRows.map((r) => getRowId(r)));
    for (const key of pinnedIds) {
      const row = rowIndex.get(key);
      if (row && !seen.has(key)) {
        out.push(row);
        seen.add(key);
      }
    }
    return out;
  });


  let resize: {
    key: string;
    startX: number;
    startW: number;
    min?: number;
    max?: number;
    /** fitColumns: every column's rendered width and floor at drag start, in
        display order, and which one is being dragged. */
    fit?: FitDrag;
  } | null = null;
  let justResized = false;

  function startResize(ci: number, e: PointerEvent) {
    if (!isResizable(cols[ci], resizable)) return;
    e.preventDefault();
    e.stopPropagation();
    const headCell = (e.currentTarget as HTMLElement).closest('.h') as HTMLElement | null;
    const startW = headCell ? headCell.getBoundingClientRect().width : layout.info[ci].width;
    resize = { key: cols[ci].key, startX: e.clientX, startW, min: cols[ci].minWidth, max: cols[ci].maxWidth };
    if (fitColumns && viewW > 0) {
      resize.fit = {
        keys: cols.map((c) => c.key),
        widths: layout.info.map((i) => i.width),
        floors: cols.map(fitFloor),
        at: ci,
      };
    }
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', onResizeUp);
  }
  function onResizeMove(e: PointerEvent) {
    if (!resize) return;
    const w = clampWidth(resize.startW + (e.clientX - resize.startX), resize.min, resize.max);
    colState.widths = resize.fit ? { ...colState.widths, ...fitResize(resize.fit, w) } : { ...colState.widths, [resize.key]: w };
  }
  function onResizeUp() {
    if (!resize) return;
    const { key } = resize;
    resize = null;
    justResized = true; // swallow the click that ends this drag (no sort toggle)
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', onResizeUp);
    colState.saveWidths();
    onColumnResize?.(key, colState.widths[key]);
  }
  /** Double-click a resize grip to clear the override and restore the default. */
  function resetWidth(ci: number, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    colState.resetWidth(cols[ci].key);
  }

  // Cycle one key: undefined → asc → desc → removed.
  function nextDir(dir: SortDir | undefined): SortDir | null {
    if (dir === undefined) return 'asc';
    if (dir === 'asc') return 'desc';
    return null; // was desc → drop the key
  }

  function toggleSort(col: ColumnDef, additive: boolean) {
    if (justResized) {
      justResized = false;
      return;
    }
    if (!isSortable(col)) return;
    const current = sorts.find((s) => s.key === col.key);
    const dir = nextDir(current?.dir);

    if (additive) {
      // Shift-click: add/cycle this key while keeping the rest of the order.
      const rest = sorts.filter((s) => s.key !== col.key);
      setSorts(dir ? [...rest, { key: col.key, dir }] : rest);
      return;
    }
    // Plain click: sort by this column alone. If it's already the sole key,
    // cycle its direction (asc → desc → off); otherwise start fresh ascending.
    const soleAndSame = sorts.length === 1 && sorts[0].key === col.key;
    if (soleAndSame) setSorts(dir ? [{ key: col.key, dir }] : []);
    else setSorts([{ key: col.key, dir: 'asc' }]);
  }

  // Sort direction + 1-based position for a column, or null if unsorted.
  function sortInfo(key: string): { dir: SortDir; pos: number } | null {
    const i = sorts.findIndex((s) => s.key === key);
    return i === -1 ? null : { dir: sorts[i].dir, pos: i + 1 };
  }

  // In-memory pipeline (skipped entirely in source mode).
  // Resolve a column's value by key (computed-aware) — for filtering and the
  // set-filter distinct list. Falls back to the raw row field for plain columns.
  const colByKey = $derived(new Map(columns.map((c) => [c.key, c] as const)));
  const valueOf = (row: GridRow, key: string): unknown => {
    const c = colByKey.get(key);
    return c ? cellValue(c, row) : row[key];
  };

  // Bumped by api.refresh(): the one way to make filter and sort catch up with
  // values that changed in place (a live feed) without re-sorting every tick.
  let viewTick = $state(0);
  const view = $derived.by(() => {
    if (source) return [] as GridRow[];
    viewTick;
    const base = rows;
    const allCols = columns;
    const f = filter.trim().toLowerCase();
    const q = quickText.trim().toLowerCase();
    const s = sorts;
    // Active per-column filters: menu-driven structured filters (columnFilters)
    // take precedence; filterRow text inputs (colFilters) fill in the rest as
    // case-insensitive "contains".
    const active: Record<string, AnyFilter> = { ...activeColumnFilters };
    for (const [k, v] of Object.entries(colFilters)) {
      if (!active[k] && v.trim()) active[k] = { kind: 'text', op: 'contains', q: v };
    }
    const hasColFilters = Object.keys(active).length > 0;
    return untrack(() => {
      let r = base;
      if (f) r = r.filter((row) => allCols.some((c) => String(cellValue(c, row) ?? '').toLowerCase().includes(f)));
      if (q) r = r.filter((row) => allCols.some((c) => String(cellValue(c, row) ?? '').toLowerCase().includes(q)));
      if (hasColFilters) {
        r = r.filter((row) => passesFilters(row, active, valueOf, filterTypes));
      }
      if (s.length > 0) r = sortRows(r, s, allCols);
      return r;
    });
  });

  // Conditional-formatting ranges: the data extent (min/max over the current
  // view) for each column with a data bar or colour scale. Per-column `min`/`max`
  // config overrides are applied later, in the cell. Keyed by column key.
  const cfRanges = $derived.by<Record<string, { min: number; max: number }>>(() => {
    live.dataVersion;
    const out: Record<string, { min: number; max: number }> = {};
    for (const col of columns) {
      if (!col.dataBar && !col.colorScale) continue;
      let lo = Infinity;
      let hi = -Infinity;
      for (const row of view) {
        const raw = cellValue(col, row);
        if (raw === null || raw === undefined || raw === '') continue; // blanks aren't 0
        const n = Number(raw);
        if (!Number.isFinite(n)) continue;
        if (n < lo) lo = n;
        if (n > hi) hi = n;
      }
      if (!Number.isFinite(lo)) lo = 0;
      if (!Number.isFinite(hi)) hi = lo + 1;
      out[col.key] = { min: lo, max: hi };
    }
    return out;
  });

  // Pagination (in-memory only): slice the view into pages; rows still
  // virtualize within a page. Off when the page size is <= 0.
  // Effective page size: a runtime pick from `pageSizeOptions` (uncontrolled),
  // else the `pageSize` prop.
  let internalPageSize = $state<number | null>(null);
  const effPageSize = $derived(internalPageSize ?? pageSize);
  function setPageSize(size: number): void {
    internalPageSize = size;
    onPageSizeChange?.(size);
    setPage(0); // a new page size invalidates the current page index
  }
  const paged = $derived(effPageSize > 0 && !source);
  let internalPage = $state(0);
  const currentPage = $derived(page ?? internalPage); // controlled by `page` prop, else internal
  function setPage(p: number): void {
    if (page === undefined) internalPage = p; // uncontrolled: own the state
    onPageChange?.(p); // always notify
  }
  const pageCount = $derived(paged ? Math.max(1, Math.ceil(view.length / effPageSize)) : 1);
  // Keep the page in range when the view shrinks (filter/sort changes).
  $effect(() => {
    const max = pageCount - 1;
    untrack(() => {
      if (currentPage > max) setPage(max);
    });
  });
  const pageRows = $derived(
    paged ? view.slice(currentPage * effPageSize, currentPage * effPageSize + effPageSize) : view,
  );

  const treeData = $derived(!!(getChildren || loadChildren) && !source);
  // Server-side (lazy) grouping: group summaries up front, rows on expand.
  const lazyGrouped = $derived(!!lazyGroups && !source && !treeData);

  // Drag-to-reorder rows (flat, unsorted, in-memory only). The handle lives in
  // the first cell; the dragged/drop indices are tracked in component state.
  const reorderable = $derived(
    !!onRowReorder && !source && !treeData && groupBy.length === 0 && effPageSize <= 0,
  );
  let dragRowVr = $state(-1);
  let dropRowVr = $state(-1);
  function onRowDrop() {
    if (dragRowVr >= 0 && dropRowVr >= 0 && dragRowVr !== dropRowVr) {
      onRowReorder?.(dragRowVr, dropRowVr);
    }
    dragRowVr = -1;
    dropRowVr = -1;
  }

  const flat = $derived.by<VisualRow[]>(() => {
    if (treeData) {
      const roots = rows;
      rowState.expandVersion; // track expand/collapse
      rowState.loadVersion; // track async child loads
      return untrack(() =>
        buildTreeRows(roots, {
          childrenOf: (r) => (loadChildren ? rowState.loadedRows(getRowId(r)) : getChildren?.(r)),
          hasChildren: hasChildren ?? ((r) => !!getChildren?.(r)?.length),
          isExpanded: (r) => rowState.isExpanded(getRowId(r)),
          isLoading: (r) => rowState.isLoading(getRowId(r)),
        }),
      );
    }
    if (lazyGrouped && lazyGroups) {
      const groups = lazyGroups;
      rowState.expandVersion; // track expand/collapse
      rowState.loadVersion; // track async row loads
      return untrack(() =>
        buildLazyGroupRows(groups, {
          isExpanded: (key) => rowState.isExpanded(key),
          rowsOf: (key) => rowState.loadedRows(key),
          isLoading: (key) => rowState.isLoading(key),
        }),
      );
    }
    const v = pageRows;
    const gb = groupBy;
    rowState.collapseVersion;
    return untrack(() => buildFlatRows(v, gb, rowState.collapsed));
  });

  function goToPage(p: number): void {
    const next = Math.max(0, Math.min(p, pageCount - 1));
    if (next === currentPage) return;
    setPage(next);
    sel.clear();
    editing = null;
    if (viewportEl) viewportEl.scrollTop = 0;
  }

  // Header select-all state over the in-memory rows (source mode can't enumerate
  // unloaded ids, so the header checkbox is disabled there).
  const selectAll = $derived.by(() => {
    if (source) return { checked: false, indeterminate: false };
    const v = view;
    let n = 0;
    for (const r of v) if (rowState.isSelected(getRowId(r))) n++;
    return { checked: n > 0 && n === v.length, indeterminate: n > 0 && n < v.length };
  });

  function toggleAll(): void {
    if (source) return;
    rowState.setSelected(
      view.map((r) => getRowId(r)),
      !selectAll.checked,
    );
    onRowSelectionChange?.(rowState.selectedIds());
  }

  // Pinned totals row: per-column `groupAgg` over all (filtered) rows. Reads row
  // values reactively so it stays live with the feed. In-memory mode only.
  const footerCells = $derived.by<string[] | null>(() => {
    live.dataVersion;
    if (!footer || source) return null;
    const v = view;
    return cols.map((col) => {
      if (col.type === 'sparkline' || col.type === 'text' || col.type === 'custom' || !col.groupAgg) return '';
      const vals: number[] = [];
      for (const row of v) {
        const n = Number(cellValue(col, row));
        if (Number.isFinite(n)) vals.push(n);
      }
      const a = aggregate(vals);
      if (!a) return '';
      return col.groupAgg === 'count' ? String(a.count) : formatCell(col, a[col.groupAgg]);
    });
  });

  // Unified row count: from the source total or the flattened in-memory list.
  const rowCount = $derived(source ? (controller?.total ?? 0) : flat.length);
  // Row numbers count data rows in view order (group headers get none); a
  // source's rows are all data, numbered by position.
  const ordinals = $derived(rowNumbers && !source ? dataOrdinals(flat) : null);
  const rowNumberAt = (vr: number): string => {
    const n = ordinals ? ordinals[vr] : vr + 1;
    return n ? String(n) : '';
  };

  const maxR = $derived(rowCount - 1);
  const maxC = $derived(cols.length - 1);

  // Row-height model. Uniform (O(1)) by default; a function rowHeight switches to
  // a prefix-sum model (in-memory only — source mode can't know unloaded heights).
  const baseH = $derived(typeof rowHeight === 'number' && rowHeight > 0 ? rowHeight : ROW_H);
  const variable = $derived(typeof rowHeight === 'function' && !source);
  // Use a prefix-sum height model when row heights vary: a `rowHeight` function,
  // or master-detail expansion (expanded rows are taller by `detailHeight`).
  const useHeights = $derived(variable || expandable);
  const heights = $derived.by<number[] | null>(() => {
    if (!useHeights) return null;
    const fn = variable ? (rowHeight as (row: GridRow, index: number) => number) : null;
    rowState.expandVersion; // track expansion changes
    const arr = new Array<number>(flat.length);
    let di = 0;
    for (let i = 0; i < flat.length; i++) {
      const it = flat[i];
      if (it.kind !== 'data') {
        arr[i] = baseH;
        continue;
      }
      let h = fn ? Math.max(1, fn(it.row, di++)) : baseH;
      if (expandable && rowState.isExpanded(getRowId(it.row))) h += detailHeight;
      arr[i] = h;
    }
    return arr;
  });
  const hm = $derived(useHeights && heights ? variableHeights(heights) : uniformHeights(rowCount, baseH));

  const total = $derived(hm.total);
  const rowWidthStyle = $derived(
    hScroll ? `width:${layout.totalWidth + leadPx}px;min-width:100%;right:auto;` : '',
  );
  const visibleCount = $derived(Math.ceil(viewPx / baseH) + OVERSCAN * 2);
  // Row recycling (uniform heights): render a window of exactly `recycleSlots`
  // rows from `start` and key rows by `vr % recycleSlots`. A constant-length
  // window makes the row that scrolls out free exactly the key the row that
  // scrolls in needs, so its cells update in place instead of being destroyed
  // and remounted — mounting ~25 cells per row was most of a fast scroll's cost.
  // visibleCount + 1 rows always cover the viewport plus overscan on both sides.
  const recycleSlots = $derived(useHeights ? 0 : visibleCount + 1);
  const start = $derived(Math.max(0, hm.indexAt(scrollTop) - OVERSCAN));
  const renderEnd = $derived(
    source
      ? (controller && controller.total > 0 ? Math.min(start + visibleCount, controller.total) : start + visibleCount)
      : recycleSlots
        ? Math.min(flat.length, start + recycleSlots)
        : Math.min(flat.length, hm.indexAt(scrollTop + viewPx) + OVERSCAN + 1),
  );

  // Source mode renders a constant visibleCount-row window, so it recycles on
  // that length; in-memory mode on recycleSlots (0 = variable heights, no recycling).
  const rowSlots = $derived(source ? visibleCount : recycleSlots);

  type RenderItem =
    | { vr: number; kind: 'group'; group: GroupNode }
    | { vr: number; kind: 'data'; row: GridRow; depth?: number; hasChildren?: boolean }
    | { vr: number; kind: 'treeloading'; depth: number }
    | { vr: number; kind: 'skeleton' };

  // Render items are reused while the row behind a visual index is the same:
  // the keyed {#each} then sees an identical item and skips the row entirely.
  // Rebuilding every item on each scroll step made every on-screen cell
  // re-evaluate its props just to mount the one row that scrolled in.
  type ItemEntry = { src: unknown; depth?: number; kids?: boolean; item: RenderItem };
  let itemCache = new Map<number, ItemEntry>();
  const renderItems = $derived.by<RenderItem[]>(() => {
    const out: RenderItem[] = [];
    const prev = itemCache;
    const next = new Map<number, ItemEntry>();
    // Data items are keyed by their row object (plus tree shape), not by the
    // VisualRow wrapper that every sort/filter rebuilds: after a re-sort, a row
    // that kept its position keeps its item and skips repainting.
    const reuse = (vr: number, src: unknown, make: () => RenderItem, depth?: number, kids?: boolean): RenderItem => {
      const hit = prev.get(vr);
      const entry =
        hit && hit.src === src && hit.depth === depth && hit.kids === kids ? hit : { src, depth, kids, item: make() };
      next.set(vr, entry);
      return entry.item;
    };
    if (source && controller) {
      controller.version; // track cache updates
      for (let vr = start; vr < renderEnd; vr++) {
        const row = controller.rowAt(vr);
        out.push(reuse(vr, row ?? null, () => (row ? { vr, kind: 'data', row } : { vr, kind: 'skeleton' })));
      }
    } else {
      for (let vr = start; vr < renderEnd; vr++) {
        const item = flat[vr];
        if (!item) continue;
        if (item.kind === 'data') {
          out.push(
            reuse(
              vr,
              item.row,
              () => ({ vr, kind: 'data', row: item.row, depth: item.depth, hasChildren: item.hasChildren }),
              item.depth,
              item.hasChildren,
            ),
          );
        } else {
          out.push(
            reuse(vr, item, () =>
              item.kind === 'group' ? { vr, kind: 'group', group: item.group } : { vr, kind: 'treeloading', depth: item.depth },
            ),
          );
        }
      }
    }
    itemCache = next;
    return out;
  });

  // onViewportChange: report the data rows on screen whenever that set
  // changes. Rows compare by identity, so a value-only tick never reports and
  // a scroll reports once per new window, not once per frame.
  let viewReported: ViewportRange | null = null;
  $effect(() => {
    const report = onViewportChange;
    if (!report) return;
    const rows: GridRow[] = [];
    let first = -1;
    let last = -1;
    for (const it of renderItems) {
      if (it.kind !== 'data') continue;
      if (first < 0) first = it.vr;
      last = it.vr;
      rows.push(it.row);
    }
    const prev = viewReported;
    if (
      prev &&
      prev.first === first &&
      prev.last === last &&
      prev.rows.length === rows.length &&
      prev.rows.every((r, i) => r === rows[i])
    )
      return;
    const view = { first, last, rows };
    viewReported = view;
    untrack(() => report(view));
  });

  // Merged cells (spanRows / colSpan). Built from the view like grouping:
  // value reads are untracked, so a ticking feed never rebuilds the plan.
  const mergePlan = $derived.by<MergePlan | null>(() => {
    if (source) return null;
    const visCols = cols;
    if (!visCols.some((c) => c.spanRows || c.colSpan)) return null;
    const items = flat;
    const info = layout.info;
    const colSpanOn = !virtualizeColumns;
    if (expandable) rowState.expandVersion;
    return untrack(() =>
      buildMergePlan({
        columns: visCols,
        count: items.length,
        rowAt: (vr) => {
          const it = items[vr];
          return it && it.kind === 'data' ? it.row : null;
        },
        sectionOf: (ci) => (info[ci]?.side === 'left' ? 0 : info[ci]?.side === 'right' ? 2 : 1),
        breakAfter: expandable
          ? (vr) => {
              const it = items[vr];
              return !!it && it.kind === 'data' && isExpanded(getRowId(it.row));
            }
          : undefined,
        colSpan: colSpanOn,
      }),
    );
  });

  /** A cell inside a merged run or covered by a column span — not editable. */
  function isMerged(r: number, c: number): boolean {
    if (!mergePlan) return false;
    const w = mergePlan.colSpansOf(r)?.[c] ?? 1;
    return w !== 1 || !!mergePlan.runOf(c, r);
  }
  const rowBoxH = (vr: number): number => (expandable ? baseH : hm.heightOf(vr));
  function spanWidthPx(ci: number, w: number): number {
    let px = 0;
    for (let k = 0; k < w; k++) px += layout.info[ci + k]?.width ?? 0;
    return px;
  }
  function spanWidthStyle(ci: number, w: number): string {
    if (hScroll) {
      const px = spanWidthPx(ci, w);
      return `flex:0 0 ${px}px;width:${px}px;`;
    }
    return w > 1 ? combinedFlex(cols.slice(ci, ci + w)) : colStyle(cols[ci]);
  }
  // How one cell renders under the merge plan: 0 = covered by a colSpan (draw
  // nothing), 1 = under a run (transparent cover), 2 = draws a merged area.
  // Null = an ordinary cell.
  type CellMerge =
    | { k: 0 }
    | { k: 1; style: string }
    | {
        k: 2;
        r0: number;
        r1: number;
        c1: number;
        span?: { up: number; height: number; first: number; rows: number; alt: boolean };
        colspan?: number;
        flex?: string;
        px?: number;
      };
  const COVERED: CellMerge = { k: 0 };
  function mergeAt(vr: number, ci: number): CellMerge | null {
    const plan = mergePlan as MergePlan;
    const w = plan.colSpansOf(vr)?.[ci] ?? 1;
    if (w === 0) return COVERED;
    const run: SpanRun | null = plan.runOf(ci, vr);
    if (!run && w === 1) return null;
    if (run && vr !== run.start && vr !== start) return { k: 1, style: spanWidthStyle(ci, w) };
    let span;
    if (run) {
      const top = hm.offsetOf(run.start);
      span = {
        up: hm.offsetOf(vr) - top,
        height: hm.offsetOf(run.end) + rowBoxH(run.end) - top,
        first: rowBoxH(run.start),
        rows: run.end - run.start + 1,
        alt: run.start % 2 === 1,
      };
    }
    return {
      k: 2,
      r0: run ? run.start : vr,
      r1: run ? run.end : vr,
      c1: ci + w - 1,
      span,
      colspan: w > 1 ? w : undefined,
      flex: !explicitWidths && w > 1 ? combinedFlex(cols.slice(ci, ci + w)) : undefined,
      px: explicitWidths ? spanWidthPx(ci, w) : undefined,
    };
  }
  function rectSelected(r0: number, r1: number, c0: number, c1: number): boolean {
    const b = sel.bounds;
    return !!b && b.r0 <= r1 && b.r1 >= r0 && b.c0 <= c1 && b.c1 >= c0;
  }
  function rectFocused(r0: number, r1: number, c0: number, c1: number): boolean {
    const f = sel.focus;
    return !!f && f.r >= r0 && f.r <= r1 && f.c >= c0 && f.c <= c1;
  }

  const stickyGroups = $derived(
    !source && groupBy.length > 0 ? activeGroupsAt(flat, hm.indexAt(scrollTop)) : [],
  );

  // Fetch the visible window whenever it, the sort, or the filter changes.
  $effect(() => {
    const ctrl = controller;
    if (!ctrl) return;
    const range = { start, end: start + visibleCount };
    const s = sorts;
    const f = filter;
    const cf = activeColumnFilters;
    void ctrl.fetch(range, s, f, cf);
  });

  function dataAt(r: number): GridRow | null {
    if (source && controller) return controller.rowAt(r);
    const item = flat[r];
    return item && item.kind === 'data' ? item.row : null;
  }

  const agg = $derived.by<AggResult | null>(() => {
    live.dataVersion;
    const b = sel.bounds;
    if (!b || sel.count <= 1) return null;
    const vals: number[] = [];
    const rEnd = Math.min(b.r1, rowCount - 1);
    const cEnd = Math.min(b.c1, cols.length - 1);
    for (let r = b.r0; r <= rEnd; r++) {
      const row = dataAt(r);
      if (!row) continue;
      for (let c = b.c0; c <= cEnd; c++) {
        if (!isNumeric(cols[c])) continue;
        const v = Number(cellValue(cols[c], row));
        if (Number.isFinite(v)) vals.push(v);
      }
    }
    return aggregate(vals);
  });

  function onScroll(e: Event) {
    const el = e.currentTarget as HTMLElement;
    scrollTop = el.scrollTop;
    if (hoverBox?.pinned && el.scrollLeft !== scrollLeft) clearColHover();
    if (hScroll) scrollLeft = el.scrollLeft; // drives column virtualization
    if (hScroll && headEl) headEl.scrollLeft = el.scrollLeft; // keep header in sync
    if (hScroll && filterRowEl) filterRowEl.scrollLeft = el.scrollLeft; // and the filter row
    if (hScroll && groupHeadEl) groupHeadEl.scrollLeft = el.scrollLeft; // and group headers
    if (tip) tip = null; // a stale fixed-position bubble would float away on scroll
  }

  // Tooltip hover delegation (only wired when a column opts in). Matches both
  // data cells (`.c[data-bo-tip]`) and column headers (`.h[data-bo-tip]`).
  function onTipOver(e: PointerEvent) {
    const cell = (e.target as HTMLElement | null)?.closest?.('[data-bo-tip]') as HTMLElement | null;
    const text = cell?.dataset.boTip;
    if (!cell || !text) {
      if (tip) tip = null;
      return;
    }
    const rect = cell.getBoundingClientRect();
    const below = rect.top < 72; // not enough room above near the header — flip down
    const x = Math.min(Math.max(rect.left + rect.width / 2, 96), window.innerWidth - 96);
    tip = { text, x, y: below ? rect.bottom + 7 : rect.top - 7, below };
  }
  function onTipOut(e: PointerEvent) {
    const to = e.relatedTarget as HTMLElement | null;
    if (to?.closest?.('[data-bo-tip]')) return; // moved within the same tipped cell/header
    if (tip) tip = null;
  }

  // Column hover (`columnHover`): one overlay over the hovered column, not a
  // class on each of its cells, plus a class on its header. It is measured off
  // the hovered cell, so flex, fixed, spanned and pinned columns all fit. A
  // pinned column's overlay sits over its pinned cells; horizontal scrolling
  // drops it, since those cells stay put while the body moves under them.
  let hoverCol = $state(-1);
  let hoverBox = $state<{ left: number; width: number; pinned: boolean } | null>(null);
  let spacerEl: HTMLDivElement | undefined = $state();
  function onColHoverOver(e: PointerEvent) {
    if (e.pointerType === 'touch' || !spacerEl) return;
    const cell = (e.target as HTMLElement | null)?.closest?.('.row [role=gridcell]') as HTMLElement | null;
    if (!cell) return;
    const ci = Number(cell.getAttribute('aria-colindex')) - 1 - leadCols;
    if (!(ci >= 0 && ci < cols.length)) return;
    const r = cell.getBoundingClientRect();
    const left = r.left - spacerEl.getBoundingClientRect().left;
    if (ci === hoverCol && hoverBox?.left === left && hoverBox.width === r.width) return;
    hoverCol = ci;
    hoverBox = { left, width: r.width, pinned: pinned && !!layout.info[ci]?.pinned };
  }
  function clearColHover() {
    hoverCol = -1;
    hoverBox = null;
  }
  // Columns that move or resize leave a measured overlay behind.
  $effect(() => {
    void layout;
    untrack(clearColHover);
  });
  function onViewportOver(e: PointerEvent) {
    if (hasTooltips) onTipOver(e);
    if (columnHover) onColHoverOver(e);
  }

  function toggleGroup(path: string) {
    rowState.toggleCollapsed(path);
    sel.clear();
  }

  function onCellDown(r: number, c: number, e: PointerEvent) {
    if (e.button !== 0) return;
    // Display grid: skip range selection but let onclick (row/cell click) fire.
    if (!cellSelection) return;
    e.preventDefault();
    gridEl?.focus();
    if (e.shiftKey) sel.extendTo(r, c);
    else sel.start(r, c);
    dragging = true;
  }

  function onCellEnter(r: number, c: number) {
    if (filling) fillTo = { r, c };
    else if (dragging) sel.extendTo(r, c);
  }

  // Fill handle: start dragging from the selection's bottom-right corner.
  function onFillStart(): void {
    const b = sel.bounds;
    if (!b) return;
    fillSource = { ...b };
    fillTo = { r: b.r1, c: b.c1 };
    filling = true;
  }
  // The rectangle the fill drag currently covers (extends down/right only).
  const fillRange = $derived(filling && fillSource && fillTo ? fillExtent(fillSource, fillTo) : null);
  function inFillPreview(r: number, c: number): boolean {
    const fr = fillRange;
    return !!fr && r >= fr.r0 && r <= fr.r1 && c >= fr.c0 && c <= fr.c1 && !sel.contains(r, c);
  }
  // Commit the fill: tile the source block's values across the extended range.
  function commitFill(): void {
    if (!filling) return;
    filling = false;
    const b = fillSource;
    const ft = fillTo;
    fillTo = null;
    fillSource = null;
    const plan = b && ft ? fillPlan(b, ft) : null;
    if (!plan) return;
    history.batch(() => {
      for (const w of plan.writes) {
        const srcRow = dataAt(w.fromR);
        if (srcRow) writeCell(w.r, w.c, String(srcRow[cols[w.fromC].key] ?? ''));
      }
    });
    sel.anchor = { r: plan.extent.r0, c: plan.extent.c0 };
    sel.focus = { r: plan.extent.r1, c: plan.extent.c1 };
  }

  // Right-click row menu (floating).
  let menu = $state<{ x: number; y: number; items: Array<{ label: string; onSelect: () => void }> } | null>(null);
  function openRowMenu(row: GridRow, e: MouseEvent) {
    const pin = rowPinning ? rowPinItem(row) : null;
    const items = [...(pin ? [pin] : []), ...(rowMenu ? rowMenu(row) : [])];
    if (items.length === 0) return;
    e.preventDefault();
    menu = { x: e.clientX, y: e.clientY, items };
  }
  $effect(() => {
    if (menu) return dismissOnOutside(() => (menu = null));
  });

  // Header filter menu (v0.3), lazy-loaded on first open to keep the core lean.
  let FilterMenuComp = $state<typeof import('./FilterMenu.svelte').default | null>(null);
  let filterUi = $state<{
    key: string;
    kind: string;
    column: ColumnDef;
    values: string[];
    x: number;
    y: number;
  } | null>(null);
  function filterKindFor(col: ColumnDef): string {
    return typeof col.filter === 'string' ? col.filter : defaultFilterKind(col);
  }
  async function openFilterMenu(col: ColumnDef, anchor: { left: number; bottom: number }) {
    let kind = filterKindFor(col);
    // A set filter needs distinct values; in source mode they can't be
    // enumerated, so fall back to the column's typed filter.
    if (source && kind === 'set') kind = defaultFilterKind(col);
    const wantsValues = kind === 'set' || !!filterTypes?.[kind]?.needsValues;
    const values = !source && wantsValues ? distinctValues(rows, col.key, valueOf) : [];
    if (!FilterMenuComp) FilterMenuComp = (await import('./FilterMenu.svelte')).default;
    filterUi = { key: col.key, kind, column: col, values, x: anchor.left, y: anchor.bottom + 2 };
  }
  function applyColumnFilter(key: string, f: AnyFilter | null): void {
    const next = { ...activeColumnFilters };
    if (f) next[key] = f;
    else delete next[key];
    setColumnFilters(next);
    filterUi = null;
  }
  $effect(() => {
    if (filterUi) return dismissOnOutside(() => (filterUi = null));
  });

  // Autosize a column to its content (a character-count heuristic — no DOM
  // measurement, so it's cheap and deterministic). Sets the same width override
  // as a manual resize.
  function autosizeColumn(col: ColumnDef): void {
    const CHAR_PX = 7.5;
    const PAD = 32; // cell padding + room for the header icons
    let maxLen = col.header.length;
    if (!source) {
      for (const row of view.slice(0, 500)) {
        const s = formatCell(col, cellValue(col, row), row);
        if (s.length > maxLen) maxLen = s.length;
      }
    }
    const w = clampWidth(Math.round(maxLen * CHAR_PX) + PAD, col.minWidth, col.maxWidth);
    colState.setWidth(col.key, w);
    onColumnResize?.(col.key, w);
  }

  // ---- Realtime path (`api.patchRows`, `api.flashCells`; live.svelte.ts) -----
  const live = createLiveRows();
  const rowIndex = $derived(new Map(rows.map((r) => [getRowId(r), r] as const)));

  function refresh(): void {
    viewTick++;
  }

  /** The rows on screen: the body's, then the pinned ones above the scroll. */
  function* renderedRows(): Generator<GridRow> {
    for (const item of renderItems) if (item.kind === 'data') yield item.row;
    yield* topRows;
  }

  function patchRows(patches: Iterable<readonly [string | number, Record<string, unknown>]>): number {
    return live.patch(rowIndex, patches, renderedRows(), getRowId);
  }

  function flashCells(opts: FlashCellsOptions = {}): number {
    const at = Date.now();
    return live.flash(opts, renderedRows(), getRowId, at, flashMotion === 'fade' ? undefined : flashHold.holds(at));
  }

  // ---- Imperative handle (`onReady`) ----------------------------------------
  function dataRowIndex(key: string | number): number {
    return flat.findIndex((v) => v.kind === 'data' && getRowId(v.row) === key);
  }

  function scrollToRow(key: string | number, align: ScrollAlign = 'nearest'): boolean {
    if (source || !viewportEl) return false;
    const vr = dataRowIndex(key);
    if (vr < 0) return false;
    viewportEl.scrollTop = scrollTopFor(align, hm.offsetOf(vr), hm.heightOf(vr), viewportEl.scrollTop, viewPx);
    return true;
  }

  function focusCell(rowKey: string | number, columnKey: string): boolean {
    if (source) return false;
    const vr = dataRowIndex(rowKey);
    const ci = cols.findIndex((c) => c.key === columnKey);
    if (vr < 0 || ci < 0) return false;
    focusTo(vr, ci, false);
    return true;
  }

  function getSelectedRows(): GridRow[] {
    return view.filter((r) => rowState.isSelected(getRowId(r)));
  }

  // ---- Auto width (`autoWidth` columns) ---------------------------------------
  // Every 500 ms, the formatted values on screen are measured with a canvas —
  // no DOM reads, so no forced layout on a live board — and a column whose
  // values no longer fit grows to them. Fonts and padding are read once per
  // column and theme.
  const AUTO_WIDTH_MS = 500;
  const meter = new TextMeter();
  $effect(() => {
    void themeStyle;
    meter.reset();
  });
  function measureAutoWidths(): void {
    if (!viewportEl || document.visibilityState === 'hidden') return;
    const data = renderItems.flatMap((it) => (it.kind === 'data' ? [it.row] : []));
    if (data.length === 0) return;
    let next: Record<string, number> | null = null;
    cols.forEach((col, ci) => {
      if (!col.autoWidth || colState.widths[col.key] != null) return;
      const m = meter.metricsFor(col.key, () =>
        viewportEl?.querySelector<HTMLElement>(`.spacer > .row > [aria-colindex="${ci + 1 + leadCols}"]`),
      );
      if (!m) return;
      const need = contentWidth(
        data.map((row) => formatCell(col, cellValue(col, row), row)),
        (t) => meter.width(t, m.font),
        m.pad,
      );
      // The width it has now: the layout's when it computes widths, else its own.
      const cur = explicitWidths ? layout.info[ci].width : col.flex ? (col.minWidth ?? 0) : (col.width ?? 96);
      if (need > cur && need > (colState.autoMeasured[col.key] ?? 0)) (next ??= { ...colState.autoMeasured })[col.key] = need;
    });
    if (next) colState.autoMeasured = next;
  }
  $effect(() => {
    if (!columns.some((c) => c.autoWidth)) return;
    const timer = setInterval(measureAutoWidths, AUTO_WIDTH_MS);
    return () => clearInterval(timer);
  });

  function autosizeColumns(keys?: string[]): void {
    const wanted = keys ? new Set(keys) : null;
    for (const col of cols) {
      if (wanted && !wanted.has(col.key)) continue;
      if (isResizable(col, resizable)) autosizeColumn(col);
    }
  }

  async function exportViewCSV(filename = 'export.csv'): Promise<void> {
    const { exportCSV } = await import('./export');
    exportCSV(filename, view, cols);
  }

  function getState(): GridState {
    return {
      version: GRID_STATE_VERSION,
      order: ordered.map((c) => c.key),
      widths: { ...colState.widths },
      hidden: [...colState.hidden],
      pinned: { ...colState.pins },
      sorts: sorts.map((s) => ({ ...s })),
      filters: { ...activeColumnFilters },
      ...(rowPinning || rowState.pinned.length > 0 ? { pinnedRows: [...rowState.pinned] } : {}),
    };
  }

  function applyState(state: unknown): boolean {
    const st = reconcileState(state, columns.map((c) => c.key));
    if (!st) return false;
    const indexOf = new Map(columns.map((c, i) => [c.key, i] as const));
    colState.setOrder(st.order.map((k) => indexOf.get(k) as number));
    colState.widths = st.widths;
    colState.saveWidths();
    setRuntimeHidden(st.hidden);
    colState.setPins(st.pinned);
    setSorts(st.sorts);
    setColumnFilters(st.filters);
    if (st.pinnedRows) setPinnedIds(st.pinnedRows);
    sel.clear();
    editing = null;
    return true;
  }

  $effect(() => {
    untrack(() =>
      onReady?.({ scrollToRow, focusCell, getSelectedRows, autosizeColumns, exportCSV: exportViewCSV, getState, applyState, patchRows, refresh, flashCells, pinRow, getPinnedRowIds, openFind }),
    );
  });

  // Column header menu (⋮): sort / pin / autosize / hide. Reuses the floating
  // RowMenu (a light action list — no lazy chunk, unlike the filter menu).
  // `anchor` positions the (keyboard-reachable) Filter submenu at the column.
  function columnMenuItems(
    col: ColumnDef,
    anchor: { left: number; bottom: number },
  ): Array<{ label: string; onSelect: () => void }> {
    const items: Array<{ label: string; onSelect: () => void }> = [];
    if (isSortable(col)) {
      items.push({ label: L.sortAscending, onSelect: () => setSorts([{ key: col.key, dir: 'asc' }]) });
      items.push({ label: L.sortDescending, onSelect: () => setSorts([{ key: col.key, dir: 'desc' }]) });
      if (sortInfo(col.key)) {
        items.push({ label: L.clearSort, onSelect: () => setSorts(sorts.filter((s) => s.key !== col.key)) });
      }
    }
    // Keyboard path to filtering (the header funnel is pointer-only by design).
    if (filterMenu && col.type !== 'sparkline' && col.filter !== false) {
      items.push({ label: L.filterEllipsis, onSelect: () => void openFilterMenu(col, anchor) });
    }
    const side = colState.pinSideOf(col.key, col.pinned);
    if (side !== 'left') items.push({ label: L.pinLeft, onSelect: () => colState.setPin(col.key, 'left') });
    if (side !== 'right') items.push({ label: L.pinRight, onSelect: () => colState.setPin(col.key, 'right') });
    if (side) items.push({ label: L.unpin, onSelect: () => colState.setPin(col.key, false) });
    if (isResizable(col, resizable)) items.push({ label: L.autosize, onSelect: () => autosizeColumn(col) });
    items.push({ label: L.hideColumn, onSelect: () => hideColumn(col.key) });
    return items;
  }
  function openColumnMenu(col: ColumnDef, e: Event) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const anchor = { left: rect.left, bottom: rect.bottom };
    menu = { x: rect.left, y: rect.bottom + 2, items: columnMenuItems(col, anchor) };
  }

  function onCellClicked(r: number, c: number, e: MouseEvent) {
    if (!onCellClick) return;
    const row = dataAt(r);
    if (!row) return;
    const column = cols[c];
    onCellClick({ row, column, value: cellValue(column, row) }, e);
  }

  // Move the focus to an absolute (r, c), clamped; extend the selection if asked.
  function focusTo(r: number, c: number, extend: boolean) {
    const rr = Math.max(0, Math.min(r, maxR));
    const cc = Math.max(0, Math.min(c, maxC));
    if (extend) sel.extendTo(rr, cc);
    else sel.start(rr, cc);
    scrollFocusIntoView();
  }

  function scrollFocusIntoView() {
    const f = sel.focus;
    if (!f || !viewportEl) return;
    const top = hm.offsetOf(f.r);
    const h = hm.heightOf(f.r);
    if (top < viewportEl.scrollTop) viewportEl.scrollTop = top;
    else if (top + h > viewportEl.scrollTop + viewPx) viewportEl.scrollTop = top + h - viewPx;
    scrollColumnIntoView(f.c);
  }
  // Sideways too, when the grid scrolls horizontally: bring the column clear
  // of the pinned columns on either side. Pinned columns are always in view.
  function scrollColumnIntoView(ci: number) {
    const inf = layout.info[ci];
    if (!hScroll || !viewportEl || !inf || inf.pinned) return;
    let x = leadPx;
    let leftPin = 0;
    let rightPin = 0;
    layout.info.forEach((c, i) => {
      if (i < ci) x += c.width;
      if (c.pinned && c.side === 'right') rightPin += c.width;
      else if (c.pinned) leftPin += c.width;
    });
    const sl = viewportEl.scrollLeft;
    if (x < sl + leadPx + leftPin) viewportEl.scrollLeft = x - leadPx - leftPin;
    else if (x + inf.width > sl + viewportEl.clientWidth - rightPin) viewportEl.scrollLeft = x + inf.width - viewportEl.clientWidth + rightPin;
  }

  // ---- Find in grid (`findBar`) ----------------------------------------------
  // The bar (FindBar.svelte) loads on first open, like the filter menu. A new
  // request object per open lets it search for a query and refocus its input.
  let FindBarComp = $state<typeof import('./FindBar.svelte').default | null>(null);
  let findRequest = $state<{ query?: string; n: number } | null>(null);
  async function openFind(query?: string) {
    if (!FindBarComp) FindBarComp = (await import('./FindBar.svelte')).default;
    findRequest = { query, n: (findRequest?.n ?? 0) + 1 };
  }
  function closeFind() {
    findRequest = null;
    gridEl?.focus();
  }

  async function copySelection() {
    const b = sel.bounds;
    if (!b) return;
    const text = copyText(b, rowCount, cols.length, (r) => !!dataAt(r), (r, c) => {
      const col = cols[c];
      const row = dataAt(r) as GridRow;
      return col.type === 'sparkline' || col.type === 'custom' ? '' : formatCell(col, cellValue(col, row), row);
    });
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  async function pasteSelection() {
    if (!onCellEdit) return; // no sink for edits — paste is a no-op
    const anchor = sel.bounds;
    if (!anchor) return;
    let text = '';
    try {
      text = (await navigator.clipboard?.readText()) ?? '';
    } catch {
      return; // clipboard read blocked/unavailable
    }
    const grid = parseClipboard(text);
    if (grid.length === 0) return;
    // A single value fills the selection; a block pastes from its top-left.
    const plan = pastePlan(grid, anchor, rowCount, cols.length);
    let wrote = 0;
    history.batch(() => {
      for (const w of plan.writes) if (writeCell(w.r, w.c, w.raw)) wrote++;
    });
    // Surface the pasted region as the new selection so it's visible.
    if (wrote > 0) {
      sel.start(plan.extent.r0, plan.extent.c0);
      sel.extendTo(plan.extent.r1, plan.extent.c1);
    }
  }

  // The keyboard model lives in keyboard.ts: keyAction reads this snapshot,
  // taken when a key arrives.
  function keyState(): KeyState {
    return {
      focus: sel.focus,
      editing: !!editing,
      maxR,
      maxC,
      pageRows: Math.max(1, Math.floor(viewPx / baseH) - 1),
      rowClick: !!onRowClick,
      rowSelection,
      findBar: findBar && !source,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      columnMenu,
      canEdit: (c) => isEditable(cols[c]),
      canTypeToEdit: (c) => {
        const col = cols[c];
        return isEditable(col) && col.type !== 'date' && !(col.options && col.options.length);
      },
      hasRow: (r) => !!dataAt(r),
      rowMenuItems: (r) => {
        const row = rowMenu ? dataAt(r) : null;
        return row && rowMenu ? rowMenu(row) : [];
      },
      treeNode: (r) => {
        const item = treeData ? flat[r] : undefined;
        if (item?.kind !== 'data' || !item.hasChildren) return null;
        return rowState.isExpanded(getRowId(item.row)) ? 'open' : 'closed';
      },
    };
  }
  /** Where the focused cell is on screen, for a menu opened from the keyboard. */
  function focusAnchor(): { left: number; bottom: number } {
    const rect = document.getElementById(activeId ?? '')?.getBoundingClientRect();
    return { left: rect?.left ?? 0, bottom: rect?.bottom ?? 0 };
  }
  function onKeydown(e: KeyboardEvent) {
    const a = keyAction(e, keyState());
    if (!a) return;
    if (a.kind !== 'clear') e.preventDefault();
    switch (a.kind) {
      case 'edit':
        return startEdit(a.r, a.c, a.seed);
      case 'rowClick': {
        const row = dataAt(a.r);
        if (row) onRowClick?.(row, e);
        return;
      }
      case 'toggleRow': {
        const row = dataAt(a.r);
        if (row) toggleRow(getRowId(row));
        return;
      }
      case 'find':
        return void openFind();
      case 'undo':
        return undo();
      case 'redo':
        return redo();
      case 'selectAll':
        return sel.selectAll(rowCount, cols.length);
      case 'copy':
        return void copySelection();
      case 'paste':
        return void pasteSelection();
      case 'clear':
        return sel.clear();
      case 'rowMenu': {
        const at = focusAnchor();
        menu = { x: at.left, y: at.bottom, items: a.items };
        return;
      }
      case 'columnMenu': {
        const at = focusAnchor();
        menu = { x: at.left, y: at.bottom, items: columnMenuItems(cols[a.c], at) };
        return;
      }
      case 'toggleTree': {
        const item = flat[a.r];
        if (item?.kind === 'data') toggleTreeNode(item.row);
        return;
      }
      case 'focus':
        return focusTo(a.r, a.c, a.extend);
      case 'move':
        sel.move(a.dr, a.dc, a.extend, maxR, maxC);
        scrollFocusIntoView();
    }
  }

  $effect(() => {
    const up = () => {
      dragging = false;
      if (filling) commitFill();
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  });

  // Positional selection: clear it whenever the row order/contents shift.
  $effect(() => {
    filter;
    sorts;
    rowState.collapseVersion;
    source;
    untrack(() => {
      sel.clear();
      editing = null;
    });
  });
</script>

<!-- `bo-grid` is an unscoped public class: a stable hook for consumer overrides. -->
<div class="bo-grid grid" style="{themeStyle}{heightIsPx ? '' : `;height:${height};min-height:0`}">
  {#if quickFilter || columnsPanel}
    <div class="bo-toolbar">
      {#if quickFilter}
        <input
          class="bo-quickfilter"
          type="search"
          placeholder="Search…"
          aria-label={L.quickFilter}
          bind:value={quickText}
        />
      {/if}
      {#if columnsPanel}
        <button class="bo-cols-toggle" type="button" onclick={openToolPanel}>⊟ {L.columns}</button>
      {/if}
    </div>
  {/if}
  {#if findRequest && FindBarComp}
    {@const Find = FindBarComp}
    <Find
      request={findRequest}
      rows={flat}
      columns={cols}
      labels={L}
      getFocus={() => sel.focus}
      onGo={(r, c) => focusTo(r, c, false)}
      onClose={closeFind}
    />
  {/if}
  <!-- The grid proper: only rows inside it. The toolbar, aggregation bar,
       pager, menus and panels around it are not part of the grid. Its role is
       grid or treegrid, both interactive; the check cannot read a dynamic role. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="gridmain"
    role={treeData ? 'treegrid' : 'grid'}
    tabindex="0"
    id={gid}
    aria-label={ariaLabel}
    aria-rowcount={rowCount + 1}
    aria-colcount={cols.length + leadCols}
    aria-multiselectable="true"
    aria-activedescendant={activeId}
    bind:this={gridEl}
    onkeydown={onKeydown}
  >
  {#if headerGroups}
    <div class="head-groups" aria-hidden="true" bind:this={groupHeadEl} style={headRowStyle}>
      {#if rowNumbers}<span class="numcell" style={numCellStyle(true)}></span>{/if}
      {#if expandable}<span class="expandcell" style={expandCellStyle(true)}></span>{/if}
      {#if rowSelection}<span class="selcell" style={selCellStyle(true)}></span>{/if}
      {#each headerGroups as g, gi (gi)}
        <span class="hg" class:blank={!g.label} style="flex:0 0 {g.width}px;width:{g.width}px;">{g.label}</span>
      {/each}
    </div>
  {/if}
  <!-- Tooltip hover delegation; header semantics live on the columnheader buttons. -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div
    class="head"
    role="row"
    aria-rowindex={1}
    bind:this={headEl}
    style={headRowStyle}
    onpointerover={hasTooltips ? onTipOver : undefined}
    onpointerout={hasTooltips ? onTipOut : undefined}
  >
    {#if rowNumbers}
      <span class="numcell selhead" role="columnheader" aria-colindex={1} style={numCellStyle(true)}
        ><span class="bo-sr-only">{L.rowNumber}</span></span
      >
    {/if}
    {#if expandable}
      <span class="expandcell selhead" role="columnheader" aria-colindex={1 + numOffset} style={expandCellStyle(true)}
        ><span class="bo-sr-only">{L.detailColumn}</span></span
      >
    {/if}
    {#if rowSelection}
      <span class="selcell selhead" role="columnheader" aria-colindex={1 + numOffset + expOffset} style={selCellStyle(true)}>
        <input
          type="checkbox"
          class="rowcheck"
          checked={selectAll.checked}
          indeterminate={selectAll.indeterminate}
          disabled={!!source}
          aria-label={L.selectAllRows}
          onclick={(e) => e.stopPropagation()}
          onchange={toggleAll}
        />
      </span>
    {/if}
    {#each cols as col, ci (ci)}
      <!-- A focusable column header, not a <button>: role="columnheader" is not
           allowed on a button. It sorts on click and on Enter / Space, and its
           name is the header text (or the column key when the header is empty),
           not the sort arrows and menu labels inside it. -->
      <div
        class="h {col.headerClass ?? ''}"
        class:colhover={hoverCol === ci}
        class:right={alignOf(col) === 'right'}
        class:sortable={isSortable(col)}
        class:dragging={ci === dragSrc}
        class:dragover={ci === dragOver && ci !== dragSrc}
        style={headStyle(ci)}
        role="columnheader"
        tabindex="0"
        aria-label={col.header || col.key}
        aria-colindex={ci + 1 + leadCols}
        data-bo-tip={col.headerTooltip}
        draggable="true"
        aria-sort={isSortable(col) && sortInfo(col.key)
          ? sortInfo(col.key)?.dir === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'}
        onclick={(e) => toggleSort(col, e.shiftKey)}
        onkeydown={(e) => {
          if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          // Handled here: the grid's own Enter / Space (edit the focused cell,
          // tick the focused row) must not run for a key pressed on a header.
          e.stopPropagation();
          toggleSort(col, e.shiftKey);
        }}
        ondragstart={(e) => {
          dragSrc = ci;
          e.dataTransfer?.setData('text/plain', String(ci));
        }}
        ondragover={(e) => {
          e.preventDefault();
          dragOver = ci;
        }}
        ondragleave={() => {
          if (dragOver === ci) dragOver = -1;
        }}
        ondrop={(e) => {
          e.preventDefault();
          moveColumn(dragSrc, ci);
          dragSrc = -1;
          dragOver = -1;
        }}
        ondragend={() => {
          dragSrc = -1;
          dragOver = -1;
        }}
      >
        <span class="label">{col.header}</span>
        {#if col.headerTooltip && col.headerInfo}
          <span class="hinfo" aria-hidden="true">i</span>
        {/if}
        {#if isSortable(col) && sortInfo(col.key)}
          {@const si = sortInfo(col.key)}
          <span class="ind">
            {si?.dir === 'asc' ? '▲' : '▼'}{#if sorts.length > 1}<span class="ord">{si?.pos}</span>{/if}
          </span>
        {/if}
        {#if filterMenu && col.type !== 'sparkline' && col.filter !== false}
          <!-- Pointer affordance only (tabindex=-1, APG grid pattern): keyboard
               users reach filtering via the column menu's "Filter…" item. -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <span
            class="funnel"
            class:on={isFilterActive(activeColumnFilters[col.key], filterTypes)}
            role="button"
            tabindex="-1"
            aria-label={L.filterFor(col.header)}
            title={L.filterFor(col.header)}
            onclick={(e) => {
              e.stopPropagation();
              openFilterMenu(col, (e.currentTarget as HTMLElement).getBoundingClientRect());
            }}
            ondragstart={(e) => e.preventDefault()}
            draggable="false"
          >
            <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
              <path d="M0 1h10L6 6v3L4 8V6z" fill="currentColor" />
            </svg>
          </span>
        {/if}
        {#if columnMenu}
          <span
            class="hmenu"
            role="button"
            tabindex="-1"
            aria-label={L.columnMenu(col.header)}
            title={L.columnMenu(col.header)}
            onclick={(e) => openColumnMenu(col, e)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') openColumnMenu(col, e);
            }}
            ondragstart={(e) => e.preventDefault()}
            draggable="false">⋮</span>
        {/if}
        {#if isResizable(col, resizable)}
          <span
            class="grip"
            role="separator"
            aria-orientation="vertical"
            aria-label={L.resizeColumn(col.header)}
            onpointerdown={(e) => startResize(ci, e)}
            ondblclick={(e) => resetWidth(ci, e)}
            ondragstart={(e) => e.preventDefault()}
            draggable="false"
          ></span>
        {/if}
      </div>
    {/each}
  </div>

  {#if filterRow && !source}
    <div class="filter-row" role="row" bind:this={filterRowEl} style={headRowStyle}>
      {#if rowNumbers}<span class="numcell" style={numCellStyle(false)}></span>{/if}
      {#if expandable}<span class="expandcell" style={expandCellStyle(false)}></span>{/if}
      {#if rowSelection}<span class="selcell" style={selCellStyle(false)}></span>{/if}
      {#each cols as col, ci (ci)}
        <span class="fr-cell" role="gridcell" aria-colindex={ci + 1 + leadCols} style={cellWidthStyle(ci, true)}>
          {#if col.type !== 'sparkline' && col.type !== 'custom'}
            <input
              class="fr-input"
              type="search"
              placeholder="filter…"
              aria-label={L.filterFor(col.header)}
              value={colFilters[col.key] ?? ''}
              oninput={(e) => (colFilters = { ...colFilters, [col.key]: e.currentTarget.value })}
            />
          {/if}
        </span>
      {/each}
    </div>
  {/if}

  <!-- Tooltip hover delegation lives on the scroll container; the grid's
       interactive semantics are on the role="grid" root. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="viewport"
    style="{heightIsPx ? `height:${height}px` : 'flex:1 1 auto;min-height:0'};{hScroll ? 'overflow-x:auto;' : ''}"
    bind:this={viewportEl}
    bind:clientWidth={viewW}
    bind:clientHeight={viewH}
    onscroll={onScroll}
    onpointerover={hasTooltips || columnHover ? onViewportOver : undefined}
    onpointerout={hasTooltips ? onTipOut : undefined}
    onpointerleave={columnHover ? clearColHover : undefined}
  >
    {#if topRows.length > 0}
      <div class="pinned-top" bind:clientHeight={pinnedH}>
        {#each topRows as prow, pi (getRowId(prow))}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="row pinrow {rowClass?.(prow) ?? ''}" role="row" aria-hidden="true" style="height:{baseH}px;{rowWidthStyle}" oncontextmenu={rowPinning || rowMenu ? (e) => openRowMenu(prow, e) : undefined}>
            {#if rowNumbers}<span class="numcell" style={numCellStyle(false)}></span>{/if}
            {#if expandable}<span class="expandcell" style={expandCellStyle(false)}></span>{/if}
            {#if rowSelection}<span class="selcell" style={selCellStyle(false)}></span>{/if}
            {#each cols as col, ci (ci)}
              <Cell
                labels={L}
                {col}
                row={prow}
                r={-1 - pi}
                c={ci}
                colIndex={ci + 1 + leadCols}
                cellId={`${gid}-pin${pi}-c${ci}`}
                cellSnippet={cell}
                rowKey={getRowId(prow)}
                version={live.rowVersion(getRowId(prow))}
                fieldVersion={live.fieldVersion(getRowId(prow), col.key)}
                {flashTracker}
                flashHold={flashMotion === 'fade' ? null : flashHold}
                cellFlash={live.cellFlash(getRowId(prow))}
                pinned={pinned && layout.info[ci].pinned}
                pinSide={layout.info[ci].side ?? 'left'}
                pinOffset={layout.info[ci].side === 'right' ? layout.info[ci].right + bodyPinFix : layout.info[ci].left + leadPx}
                width={explicitWidths ? layout.info[ci].width : undefined}
              />
            {/each}
          </div>
        {/each}
      </div>
    {/if}
    {#if rowCount === 0 && !controller?.loading}
      <div class="empty">{emptyMessage ?? L.noRows}</div>
    {/if}
    {#if loading}
      <div class="loading-overlay" aria-busy="true" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <span class="loading-label">{L.loading}</span>
      </div>
    {/if}
    {#if stickyGroups.length > 0}
      <div class="sticky" style={pinnedPx ? `top:${pinnedPx}px` : undefined}>
        {#each stickyGroups as g (g.depth)}
          <div class="sticky-row" aria-hidden="true" style="height:{baseH}px">
            <GroupRow version={live.dataVersion} group={g} columns={cols} onToggle={toggleGroup} colStart={1 + leadCols} focusable={false} />
          </div>
        {/each}
      </div>
    {/if}
    <div class="spacer" bind:this={spacerEl} style="height:{total}px;{hScroll ? `width:${layout.totalWidth + leadPx}px;` : ''}">
      {#if hoverBox}<div class="colwash" class:pin={hoverBox.pinned} aria-hidden="true" style="left:{hoverBox.left}px;width:{hoverBox.width}px"></div>{/if}
      {#each renderItems as item (rowSlots ? item.vr % rowSlots : item.vr)}
        {#if item.kind === 'group'}
          <div class="grouprow" style="top:{hm.offsetOf(item.vr)}px;height:{hm.heightOf(item.vr)}px;{rowWidthStyle}">
            {#if rowNumbers}<span class="numcell" aria-hidden="true" style={numCellStyle(false)}></span>{/if}
            {#if expandable}<span class="expandcell" aria-hidden="true" style={expandCellStyle(false)}></span>{/if}
            {#if rowSelection}<span class="selcell" aria-hidden="true" style={selCellStyle(false)}></span>{/if}
            <GroupRow version={live.dataVersion} group={item.group} columns={cols} onToggle={lazyGrouped ? toggleLazyGroup : toggleGroup} rowIndex={item.vr + 2} colStart={1 + leadCols} />
          </div>
        {:else if item.kind === 'skeleton'}
          <div class="row skeleton" role="row" aria-rowindex={item.vr + 2} aria-hidden="true" style="top:{hm.offsetOf(item.vr)}px;height:{hm.heightOf(item.vr)}px;{rowWidthStyle}">
            {#if rowNumbers}<span class="numcell" style={numCellStyle(false)}></span>{/if}
            {#if expandable}<span class="expandcell" style={expandCellStyle(false)}></span>{/if}
            {#if rowSelection}<span class="selcell" style={selCellStyle(false)}></span>{/if}
            {#each cols as col, ci (ci)}
              <span class="c" style={cellWidthStyle(ci)}><span class="skelbar"></span></span>
            {/each}
          </div>
        {:else if item.kind === 'treeloading'}
          <div class="row treeloading" role="row" aria-rowindex={item.vr + 2} aria-live="polite" style="top:{hm.offsetOf(item.vr)}px;height:{hm.heightOf(item.vr)}px;{rowWidthStyle}">
            {#if rowNumbers}<span class="numcell" aria-hidden="true" style={numCellStyle(false)}></span>{/if}
            {#if expandable}<span class="expandcell" aria-hidden="true" style={expandCellStyle(false)}></span>{/if}
            {#if rowSelection}<span class="selcell" aria-hidden="true" style={selCellStyle(false)}></span>{/if}
            <span class="tree-loading-cell" style="padding-left:{(item.depth ?? 0) * 16 + 24}px">
              <span class="spinner sm" aria-hidden="true"></span>{L.loading}
            </span>
          </div>
        {:else}
          <!-- Row activation is keyboard-accessible at the grid level: Enter on the focused cell fires onRowClick (focus is via aria-activedescendant). -->
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div class="row {rowClass?.(item.row) ?? ''}" class:alt={item.vr % 2 === 1} class:rowsel={rowSelection && isRowSelected(getRowId(item.row))} class:rowactive={selectedRowId != null && getRowId(item.row) === selectedRowId} class:clickable={!!onRowClick} class:droptarget={reorderable && dropRowVr === item.vr && dragRowVr !== item.vr} role="row" tabindex="-1" aria-rowindex={item.vr + 2} aria-selected={rowSelection ? isRowSelected(getRowId(item.row)) : undefined} aria-level={treeData ? (item.depth ?? 0) + 1 : undefined} aria-expanded={treeData && item.hasChildren ? isExpanded(getRowId(item.row)) : undefined} style="top:{hm.offsetOf(item.vr)}px;height:{expandable ? baseH : hm.heightOf(item.vr)}px;{rowWidthStyle}" onclick={(e) => onRowClick?.(item.row, e)} oncontextmenu={(e) => openRowMenu(item.row, e)} ondragover={reorderable ? (e) => { if (dragRowVr < 0) return; e.preventDefault(); dropRowVr = item.vr; } : undefined} ondrop={reorderable ? (e) => { e.preventDefault(); onRowDrop(); } : undefined}>
            {#if rowNumbers}<span class="numcell" role="rowheader" aria-colindex={1} style={numCellStyle(false)}>{rowNumberAt(item.vr)}</span>{/if}
            {#if expandable}
              <span class="expandcell" role="gridcell" aria-colindex={1 + numOffset} style={expandCellStyle(false)}>
                <button
                  class="expand-toggle"
                  type="button"
                  aria-expanded={isExpanded(getRowId(item.row))}
                  aria-label={L.toggleDetail}
                  onpointerdown={(e) => e.stopPropagation()}
                  onclick={(e) => {
                    e.stopPropagation();
                    toggleExpand(getRowId(item.row));
                  }}
                >
                  {isExpanded(getRowId(item.row)) ? '▾' : '▸'}
                </button>
              </span>
            {/if}
            {#if rowSelection}
              <span class="selcell" role="gridcell" aria-colindex={1 + numOffset + expOffset} style={selCellStyle(false)}>
                <input
                  type="checkbox"
                  class="rowcheck"
                  checked={isRowSelected(getRowId(item.row))}
                  aria-label={L.selectRow}
                  onpointerdown={(e) => e.stopPropagation()}
                  onclick={(e) => e.stopPropagation()}
                  onchange={() => toggleRow(getRowId(item.row))}
                />
              </span>
            {/if}
            {#each colItems as it (it.key)}
              {#if it.kind === 'cell'}
                {@const ci = it.ci}
                {@const col = cols[ci]}
                {@const m = mergePlan ? mergeAt(item.vr, ci) : null}
                {#if m?.k === 0}
                  <!-- covered by a column span to the left -->
                {:else if m?.k === 1}
                  <span class="c spancover" aria-hidden="true" style={m.style}></span>
                {:else}
                <Cell
                  labels={L}
                  {col}
                  row={item.row}
                  r={item.vr}
                  c={ci}
                  colIndex={ci + 1 + leadCols}
                  cellId={`${gid}-r${item.vr}-c${ci}`}
                  cellSnippet={cell}
                  rowKey={getRowId(item.row)}
                  version={live.rowVersion(getRowId(item.row))}
                  fieldVersion={live.fieldVersion(getRowId(item.row), col.key)}
                  {flashTracker}
                  flashHold={flashMotion === 'fade' ? null : flashHold}
                  cellFlash={live.cellFlash(getRowId(item.row))}
                  selected={cellSelection && (m ? rectSelected(m.r0, m.r1, ci, m.c1) : sel.contains(item.vr, ci))}
                  focused={cellSelection && (m ? rectFocused(m.r0, m.r1, ci, m.c1) : sel.isFocus(item.vr, ci))}
                  span={m?.span}
                  colspan={m?.colspan}
                  flexStyle={m?.flex}
                  pinned={pinned && layout.info[ci].pinned}
                  pinSide={layout.info[ci].side ?? 'left'}
                  pinOffset={layout.info[ci].side === 'right' ? layout.info[ci].right + bodyPinFix : layout.info[ci].left + leadPx}
                  width={explicitWidths ? (m?.px ?? layout.info[ci].width) : undefined}
                  alt={item.vr % 2 === 1}
                  editing={editing?.r === item.vr && editing?.c === ci}
                  seed={editing?.r === item.vr && editing?.c === ci ? editSeed : null}
                  fillCorner={fillHandle && !!sel.bounds && item.vr === sel.bounds.r1 && ci === sel.bounds.c1}
                  fillpreview={inFillPreview(item.vr, ci)}
                  cfRange={col.dataBar || col.colorScale ? cfRanges[col.key] : null}
                  {onFillStart}
                  tree={treeData && ci === 0
                    ? {
                        depth: item.depth ?? 0,
                        hasChildren: item.hasChildren ?? false,
                        expanded: isExpanded(getRowId(item.row)),
                        onToggle: () => toggleTreeNode(item.row),
                      }
                    : undefined}
                  dragHandle={reorderable && ci === 0
                    ? { onStart: () => (dragRowVr = item.vr), onEnd: () => (dragRowVr = -1) }
                    : undefined}
                  {onCellDown}
                  {onCellEnter}
                  onCellClick={onCellClick ? onCellClicked : undefined}
                  onCellDblClick={startEdit}
                  onEditCommit={(raw) => commitEdit(item.vr, ci, raw)}
                  onEditCommitValue={(v) => commitValue(item.vr, ci, v)}
                  onEditCancel={() => {
                    if (editing?.r !== item.vr || editing?.c !== ci) return;
                    editing = null;
                    editSeed = null;
                  }}
                />
                {/if}
              {:else}
                <span class="colspacer" aria-hidden="true" style="flex:0 0 {it.w}px;width:{it.w}px;"></span>
              {/if}
            {/each}
          </div>
          {#if expandable && detail && isExpanded(getRowId(item.row))}
            <div class="row-detail" style="top:{hm.offsetOf(item.vr) + baseH}px;height:{detailHeight}px;{rowWidthStyle}">
              {@render detail({ row: item.row })}
            </div>
          {/if}
        {/if}
      {/each}
    </div>
    {#if footerCells}
      <div class="footer" role="row" style={hScroll ? `width:${layout.totalWidth + leadPx}px;` : ''}>
        {#if rowNumbers}<span class="numcell" aria-hidden="true" style={numCellStyle(false)}></span>{/if}
        {#if expandable}<span class="expandcell" aria-hidden="true" style={expandCellStyle(false)}></span>{/if}
        {#if rowSelection}<span class="selcell" aria-hidden="true" style={selCellStyle(false)}></span>{/if}
        {#each cols as col, ci (ci)}
          <span class="fcell" role="gridcell" aria-colindex={ci + 1 + leadCols} class:right={alignOf(col) === 'right'} style={cellWidthStyle(ci)}>
            {ci === 0 && !footerCells[ci] ? L.total : footerCells[ci]}
          </span>
        {/each}
      </div>
    {/if}
  </div>
  </div>

  <AggregationBar result={agg} kinds={aggregations} {locale} />

  {#if paged}
    <Pager
      page={currentPage}
      {pageCount}
      total={view.length}
      onGoto={goToPage}
      pageSize={effPageSize}
      {pageSizeOptions}
      onPageSize={setPageSize}
      labels={L}
      {locale}
    />
  {/if}

  {#if menu}
    <RowMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => (menu = null)} />
  {/if}

  {#if filterUi && FilterMenuComp}
    {@const Menu = FilterMenuComp}
    {@const key = filterUi.key}
    <Menu
      kind={filterUi.kind}
      header={filterUi.column.header}
      column={filterUi.column}
      custom={isBuiltinFilter({ kind: filterUi.kind }) ? undefined : filterTypes?.[filterUi.kind]}
      filter={activeColumnFilters[key] ?? null}
      values={filterUi.values}
      x={filterUi.x}
      y={filterUi.y}
      onApply={(f) => applyColumnFilter(key, f)}
      onClose={() => (filterUi = null)}
      labels={L}
    />
  {/if}

  {#if panelXY && ToolPanelComp}
    {@const Panel = ToolPanelComp}
    <Panel
      columns={ordered.map((c) => ({ key: c.key, header: c.header }))}
      hidden={effectiveHidden}
      x={panelXY.x}
      y={panelXY.y}
      onToggle={toggleColumnVisible}
      onShowAll={showAllColumns}
      onClose={() => (panelXY = null)}
      labels={L}
    />
  {/if}

  {#if tip}
    <div
      class="bo-tip"
      class:below={tip.below}
      role="tooltip"
      aria-hidden="true"
      style="left:{tip.x}px;top:{tip.y}px"
    >
      {tip.text}
    </div>
  {/if}
</div>

<style>
  .grid {
    --bo-bg: var(--bo-grid-bg, #1a1a1a);
    --bo-header-bg: var(--bo-grid-header-bg, #0f0f0f);
    --bo-row-a: var(--bo-grid-row-a, #131313);
    --bo-row-b: var(--bo-grid-row-b, #0f0f0f);
    --bo-row-hover: var(--bo-grid-row-hover, #1f1f24);
    --bo-col-hover: var(--bo-grid-col-hover, color-mix(in srgb, var(--bo-text) 6%, transparent));
    --bo-text: var(--bo-grid-text, #e5e5e5);
    --bo-text-dim: var(--bo-grid-text-dim, #8a8a8a);
    --bo-border: var(--bo-grid-border, rgba(255, 255, 255, 0.06));
    --bo-up: var(--bo-grid-up, #34d399);
    --bo-down: var(--bo-grid-down, #f87171);
    --bo-amber: var(--bo-grid-amber, #f59e0b);
    --bo-sel-fill: var(--bo-grid-sel-fill, rgba(99, 102, 241, 0.16));
    --bo-sel-border: var(--bo-grid-sel-border, #6366f1);
    --bo-header-h: var(--bo-grid-header-h, 28px);
    --bo-mono: var(--bo-grid-mono, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace);
    --bo-sans: var(--bo-grid-sans, Inter, "Segoe UI", system-ui, sans-serif);
    /* Layout/density tokens (override via --bo-grid-* for a custom look). */
    --bo-radius: var(--bo-grid-radius, 8px);
    --bo-font-size: var(--bo-grid-font-size, 13px);
    --bo-cell-pad: var(--bo-grid-cell-pad, 8px);

    /* Theme native controls (checkboxes, date pickers, number spinners, search
       clear buttons, scrollbars) and accent fills to match the grid theme. */
    color-scheme: var(--bo-grid-scheme, dark);
    accent-color: var(--bo-up);

    display: flex;
    flex-direction: column;
    color: var(--bo-text);
    font-family: var(--bo-sans);
    background: var(--bo-bg);
    border: 0.5px solid var(--bo-border);
    border-radius: var(--bo-radius);
    overflow: hidden;
    position: relative;
  }
  .gridmain {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    outline: none;
  }
  .grid:has(> .gridmain:focus-visible) {
    border-color: var(--bo-sel-border);
  }
  /* Styled floating tooltip (opt-in via column `tooltip`). Fixed-positioned so
     it escapes the cell/viewport overflow; centred on the cell, flips below
     near the header. */
  .bo-tip {
    position: fixed;
    z-index: 60;
    max-width: 280px;
    padding: 5px 9px;
    font-family: var(--bo-sans);
    font-size: 12px;
    line-height: 1.45;
    color: var(--bo-text);
    background: var(--bo-header-bg);
    border: 0.5px solid var(--bo-border);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    white-space: normal;
    overflow-wrap: anywhere;
    pointer-events: none;
    transform: translate(-50%, -100%);
    animation: bo-tip-in 90ms ease-out;
  }
  .bo-tip.below {
    transform: translate(-50%, 0);
  }
  /* Caret. */
  .bo-tip::after {
    content: "";
    position: absolute;
    left: 50%;
    width: 7px;
    height: 7px;
    background: var(--bo-header-bg);
    border: 0.5px solid var(--bo-border);
    transform: translateX(-50%) rotate(45deg);
  }
  .bo-tip:not(.below)::after {
    bottom: -4px;
    border-top: 0;
    border-left: 0;
  }
  .bo-tip.below::after {
    top: -4px;
    border-bottom: 0;
    border-right: 0;
  }
  @keyframes bo-tip-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .bo-tip {
      animation: none;
    }
  }
  /* Built-in quick-filter toolbar (opt-in via `quickFilter`). */
  .bo-toolbar {
    display: flex;
    padding: 6px;
    border-bottom: 0.5px solid var(--bo-border);
    background: var(--bo-header-bg);
  }
  .bo-quickfilter {
    width: 100%;
    max-width: 260px;
    padding: 5px 9px;
    font: inherit;
    font-size: 12px;
    color: var(--bo-text);
    background: var(--bo-bg);
    border: 0.5px solid var(--bo-border);
    border-radius: 6px;
  }
  .bo-quickfilter::placeholder {
    color: var(--bo-text-dim);
  }
  .bo-cols-toggle {
    margin-left: auto;
    padding: 5px 11px;
    font: inherit;
    font-size: 12px;
    color: var(--bo-text);
    background: var(--bo-bg);
    border: 0.5px solid var(--bo-border);
    border-radius: 6px;
    cursor: pointer;
  }
  .bo-cols-toggle:hover {
    border-color: var(--bo-text-dim);
  }

  /* Spanning header groups (row above the column headers). */
  .head-groups {
    display: flex;
    align-items: stretch;
    height: var(--bo-header-h);
    background: var(--bo-header-bg);
    border-bottom: 0.5px solid var(--bo-border);
  }
  .head-groups .hg {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    padding: 0 8px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--bo-text);
    border-right: 0.5px solid var(--bo-border);
    overflow: hidden;
    white-space: nowrap;
  }
  /* An ungrouped column's slot. Not .empty: that is the absolutely positioned
     "No rows" overlay, and a slot carrying it leaves the row. */
  .head-groups .hg.blank {
    border-right: 0;
    background: transparent;
  }

  .head {
    display: flex;
    align-items: stretch;
    height: var(--bo-header-h);
    background: var(--bo-header-bg);
    border-bottom: 0.5px solid var(--bo-border);
  }
  .h {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 var(--bo-cell-pad, 8px);
    min-width: 0;
    font: inherit;
    font-size: 11px;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--bo-text-dim);
    background: transparent;
    border: 0;
    cursor: grab;
  }
  /* Text for assistive tech only (e.g. the expand column's header name). */
  .bo-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
  /* Visible keyboard focus (WCAG 2.4.7) for the grid's tabbable controls. */
  .h:focus-visible,
  .bo-cols-toggle:focus-visible,
  .expand-toggle:focus-visible,
  .bo-quickfilter:focus-visible {
    outline: 2px solid var(--bo-sel-border);
    outline-offset: -2px;
    color: var(--bo-text);
  }
  /* Drag-to-resize grip: a thin hit-target straddling the column's right edge. */
  .h .grip {
    position: absolute;
    top: 0;
    right: -3px;
    width: 7px;
    height: 100%;
    cursor: col-resize;
    z-index: 6;
    touch-action: none;
  }
  .h .grip::after {
    content: '';
    position: absolute;
    top: 20%;
    right: 3px;
    width: 1px;
    height: 60%;
    background: var(--bo-border);
    opacity: 0;
    transition: opacity 120ms;
  }
  .h .grip:hover::after,
  .h .grip:active::after {
    opacity: 1;
    background: var(--bo-sel-border);
  }
  .h.sortable {
    cursor: pointer;
  }
  .h.sortable:hover {
    color: var(--bo-text);
    background: var(--bo-row-hover);
  }
  .h.dragging {
    opacity: 0.4;
  }
  .h.dragover {
    box-shadow: inset 2px 0 0 var(--bo-sel-border);
  }
  .h.right {
    justify-content: flex-end;
  }
  .h .label {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    pointer-events: none;
  }
  .h .ind {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    font-size: 9px;
    color: var(--bo-text);
  }
  /* Header info cue: a small circled "i" signalling a headerTooltip. */
  .h .hinfo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 12px;
    height: 12px;
    margin-left: 1px;
    font-size: 8px;
    font-style: italic;
    font-family: var(--bo-mono);
    line-height: 1;
    color: var(--bo-text-dim);
    border: 0.5px solid var(--bo-text-dim);
    border-radius: 50%;
    pointer-events: none;
  }
  .h:hover .hinfo {
    color: var(--bo-text);
    border-color: var(--bo-text);
  }
  .h .ind .ord {
    font-size: 8px;
    line-height: 1;
    color: var(--bo-text-dim);
    font-variant-numeric: tabular-nums;
  }
  /* Header filter funnel: a click target that opens the (lazy) filter menu. */
  .h .funnel {
    display: inline-flex;
    align-items: center;
    margin-left: 4px;
    color: var(--bo-text-dim);
    opacity: 0.55;
    cursor: pointer;
    transition: opacity 120ms, color 120ms;
  }
  .h .funnel:hover {
    opacity: 1;
    color: var(--bo-text);
  }
  .h .funnel.on {
    opacity: 1;
    color: var(--bo-up);
  }
  /* Header column-menu (⋮) trigger. */
  .h .hmenu {
    display: inline-flex;
    align-items: center;
    margin-left: 4px;
    font-size: 14px;
    line-height: 1;
    color: var(--bo-text-dim);
    opacity: 0.55;
    cursor: pointer;
    transition: opacity 120ms, color 120ms;
  }
  .h .hmenu:hover {
    opacity: 1;
    color: var(--bo-text);
  }

  /* Per-column filter input row, under the header. */
  .filter-row {
    display: flex;
    align-items: stretch;
    height: 30px;
    border-bottom: 0.5px solid var(--bo-border);
    background: var(--bo-header-bg);
  }
  .filter-row .fr-cell {
    display: flex;
    align-items: center;
    padding: 0 4px;
    min-width: 0;
  }
  .filter-row .fr-input {
    width: 100%;
    min-width: 0;
    padding: 2px 6px;
    font: inherit;
    font-family: var(--bo-mono);
    font-size: 11px;
    color: var(--bo-text);
    background: var(--bo-bg);
    border: 0.5px solid var(--bo-border);
    border-radius: 4px;
    outline: none;
  }
  .filter-row .fr-input:focus {
    border-color: var(--bo-sel-border);
  }

  .viewport {
    position: relative;
    overflow-y: auto;
    overflow-x: hidden;
    /* Reserve the scrollbar's space whether or not the rows overflow, and the
       header rows below reserve the same: every column edge lines up with its
       body column, to the subpixel. */
    scrollbar-gutter: stable;
    user-select: none;
    /* Thin, themed scrollbars (Firefox) — Chromium/Safari below. */
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--bo-text-dim) 55%, transparent) transparent;
  }
  .viewport::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  /* flex-shrink: 0 because overflow: hidden drops a flex item's minimum height
     to 0. With a CSS height, the viewport's basis is its full content height;
     once the rows overflow, these rows would shrink with it to a few px. */
  .head,
  .head-groups,
  .filter-row {
    flex-shrink: 0;
    overflow: hidden;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
  }
  .head::-webkit-scrollbar,
  .head-groups::-webkit-scrollbar,
  .filter-row::-webkit-scrollbar {
    width: 10px;
    height: 0;
  }
  .viewport::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--bo-text-dim) 45%, transparent);
    border: 2px solid transparent;
    background-clip: padding-box;
    border-radius: 6px;
  }
  .viewport::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--bo-text-dim) 70%, transparent);
    background-clip: padding-box;
  }
  .viewport::-webkit-scrollbar-corner {
    background: transparent;
  }
  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--bo-text-dim);
    font-size: 13px;
  }
  .loading-overlay {
    position: sticky;
    top: 0;
    left: 0;
    z-index: 7;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 100%;
    margin-bottom: -100%; /* overlay without consuming scroll height */
    color: var(--bo-text-dim);
    font-size: 13px;
    background: color-mix(in srgb, var(--bo-bg) 70%, transparent);
    backdrop-filter: blur(1px);
  }
  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--bo-border);
    border-top-color: var(--bo-sel-border);
    border-radius: 50%;
    animation: bo-spin 0.7s linear infinite;
  }
  @keyframes bo-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
  .spinner.sm {
    width: 12px;
    height: 12px;
    border-width: 1.5px;
  }
  /* Async tree: placeholder row shown while a node's children load. */
  .row.treeloading {
    align-items: center;
  }
  .tree-loading-cell {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--bo-font-size, 13px);
    color: var(--bo-text-dim);
    font-style: italic;
  }
  .spacer {
    position: relative;
    width: 100%;
    min-width: 100%;
  }
  /* columnHover: one wash over the hovered column, above the rows and under
     pinned cells (z 2), sticky group rows (4) and pinned top rows (5). Its own
     class: the header's mark (.colhover) must not pick up this absolute,
     pointer-transparent box, or the header leaves its row. */
  .colwash {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 1;
    pointer-events: none;
    background: var(--bo-col-hover);
  }
  /* A pinned column's wash lies over its own pinned cells. */
  .colwash.pin {
    z-index: 3;
  }
  .h.colhover {
    background-image: linear-gradient(var(--bo-col-hover), var(--bo-col-hover));
  }

  .sticky {
    position: sticky;
    top: 0;
    height: 0;
    z-index: 4;
    overflow: visible;
  }
  .sticky-row {
    position: relative;
    left: 0;
    right: 0;
  }
  .sticky-row:last-child {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.28);
  }

  .row,
  .grouprow {
    position: absolute;
    left: 0;
    right: 0;
  }
  .row {
    display: flex;
    align-items: stretch;
    background: var(--bo-row-b);
    border-bottom: 0.5px solid var(--bo-border);
  }
  .row.alt {
    background: var(--bo-row-a);
  }
  .row:not(.skeleton):hover {
    background: var(--bo-row-hover);
  }
  .row.rowsel {
    background: var(--bo-sel-fill);
  }
  /* Controlled active-row highlight (selectedRowId) — a tint + an accent bar so
     it reads distinctly from the checkbox selection and hover. */
  .row.rowactive {
    background: var(--bo-sel-fill);
    box-shadow: inset 2px 0 0 var(--bo-sel-border);
  }
  .row.clickable {
    cursor: pointer;
  }
  .row.droptarget {
    box-shadow: inset 0 2px 0 var(--bo-sel-border);
  }

  /* Pinned top rows: stick to the top of the viewport above the scroll. */
  .pinned-top {
    position: sticky;
    top: 0;
    z-index: 5;
    background: var(--bo-bg);
    box-shadow: 0 1px 0 var(--bo-border);
  }
  .pinned-top .pinrow {
    /* In flow, unlike body rows: the area takes their height, so they stack
       and the body starts below them instead of under them. */
    position: relative;
    display: flex;
    align-items: stretch;
    min-width: 100%;
    background: color-mix(in srgb, var(--bo-header-bg) 70%, var(--bo-sel-fill) 60%);
    border-bottom: 0.5px solid var(--bo-border);
  }

  /* Pinned totals row: sticks to the bottom of the viewport. */
  .footer {
    position: sticky;
    bottom: 0;
    z-index: 4;
    display: flex;
    align-items: stretch;
    min-width: 100%;
    height: 32px;
    background: var(--bo-header-bg);
    border-top: 0.5px solid var(--bo-border);
  }
  .footer .fcell {
    display: flex;
    align-items: center;
    padding: 0 8px;
    font-family: var(--bo-mono);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--bo-text);
    overflow: hidden;
    white-space: nowrap;
  }
  .footer .fcell.right {
    justify-content: flex-end;
  }

  /* Master-detail: leading expand-toggle column + detail panel. */
  .expandcell {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }
  .expand-toggle {
    width: 20px;
    height: 20px;
    padding: 0;
    font-size: 11px;
    line-height: 1;
    color: var(--bo-text-dim);
    background: transparent;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
  }
  .expand-toggle:hover {
    color: var(--bo-text);
    background: var(--bo-row-hover);
  }
  .row-detail {
    position: absolute;
    left: 0;
    overflow: auto;
    background: var(--bo-row-a);
    border-bottom: 0.5px solid var(--bo-border);
    box-shadow: inset 0 1px 0 var(--bo-border);
  }

  /* Leading row-number column: dim, right-aligned figures, like a sheet's. */
  .numcell {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex: 0 0 auto;
    padding-right: 8px;
    font-family: var(--bo-mono);
    font-size: 0.85em;
    font-variant-numeric: tabular-nums;
    color: var(--bo-text-dim);
    user-select: none;
    box-shadow: inset -0.5px 0 0 var(--bo-border);
  }

  /* Leading checkbox column (row selection). */
  .selcell {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }
  .selhead {
    border-bottom: 0.5px solid var(--bo-border);
  }
  .rowcheck {
    width: 14px;
    height: 14px;
    cursor: pointer;
    accent-color: var(--bo-sel-border);
  }
  .rowcheck:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .skeleton .c {
    display: flex;
    align-items: center;
    padding: 0 8px;
  }
  .skelbar {
    width: 60%;
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--bo-row-hover), var(--bo-border), var(--bo-row-hover));
    background-size: 200% 100%;
    animation: shimmer 1.1s linear infinite;
  }
  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .skelbar {
      animation: none;
    }
  }
</style>
