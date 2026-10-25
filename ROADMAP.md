# Roadmap

Shipped and planned work. Versions follow semver; everything is additive and
backward-compatible unless noted.

## Shipped

- **0.1.0** — initial release (core grid, sparklines, realtime, sort/filter,
  selection, grouping, server-side `RowSource`, export, column reorder, inline
  edit, variable height, theming, ARIA, custom cells, pivot).
- **0.2.0** — the full grid: multi/controlled sort, per-column filter row,
  column resize/pin(L/R)/show-hide/header-groups, row selection, pagination,
  master-detail, tree data, row reorder, totals footer, pinned rows, tooltips,
  context menu, custom format/compare, type-to-edit, full keyboard a11y, and
  verified SSR/SvelteKit safety. ~45 features in ~20 KB gzip.

## 0.3 · Filtering & discoverability — done

Rich, built-in column filtering. **Guiding principle: keep the core tiny** — heavy menu UI is
**lazy-loaded inside `Grid`**, so the core only grows by small glue and you
download a menu only when you open one.

- [x] **M1 — Filter model + logic** (`filtering.ts`): typed `ColumnFilter`
  (text/number/date operators + set), pure + unit-tested; `view` filters through
  it; `filterRow` migrated onto it.
- [x] **M2 — Header filter menu** (lazy `FilterMenu.svelte`): per-column funnel,
  type-aware controls. `filterMenu` + per-column `col.filter`.
- [x] **M3 — Set filter**: `col.filter: 'set'` — checkbox list of distinct values.
- [x] **M5 — Quick filter**: built-in `quickFilter` global search box.

## 0.4 · Column management & discoverability — done

Runtime column management.
Heavy UI (the tool panel) is lazy-loaded; the light column menu reuses the
in-core action menu.

- [x] **M1 — Column header menu + runtime hide** (`columnMenu`).
- [x] **M2 — Runtime pinning** (Pin left/right/Unpin), layered over `col.pinned`.
- [x] **M3 — Columns tool panel** (lazy `ToolPanel.svelte`, `columnsPanel`).

Shipped API (all additive): `columnMenu`, `columnsPanel`,
`onColumnVisibilityChange`.

## 0.5 · Spreadsheet power — done

Excel-grade editing. Lib budget recalibrated 24 → 28 KB (heavy UI stays lazy
and excluded from the core count).

- [x] **M1 — Fill handle** (`fillHandle`): drag the selection's corner to copy
  the selected value(s) across the extended range (editable columns; tiles).
- [x] **M2 — Undo / redo** (Ctrl+Z / Ctrl+Y) for edits, paste and fill; row-keyed
  history (survives sort/filter); paste/fill undo as one step.
- [x] **M3 — Typed inline editors**: numeric columns edit with a number input,
  `date` columns with a native date picker (date columns are now editable).
- [x] **M4 — Autosize** — shipped in 0.7 (content heuristic, not DOM measurement).

## 0.6 · Controlled & server-side filtering — done

- [x] **M1 — Controlled filtering**: `columnFilters` prop + `onFilterChange`
  (mirrors controlled `sort`); `ColumnFilter`/`FilterKind` types exported.
- [x] **M2 — Server-side filtering**: `RowSourceParams.columnFilters`; the filter
  menu works in source mode (text/number/date delegate to the `RowSource`).

## 0.7 · Column sizing & keyboard polish — done

- [x] **Autosize column to content** via the column menu (character-count
  heuristic; respects min/max; persists like a manual resize).
- [x] **Keyboard access to the column menu** (<kbd>Alt</kbd>+<kbd>↓</kbd>).
- [x] **Themed native form controls** (checkbox / date / spinners / scrollbars)
  via `color-scheme` + `accent-color`.

## 0.8 · Design tokens & polish — done

- [x] **Deep theming tokens**: `radius`, `fontSize`, `cellPad` (shape + density),
  on top of colour/typography — any look from a small token map.
- [x] **Themed scrollbars** in the viewport (Firefox + Chromium/Safari).

## 0.9 · Rich cell types — done

Scaling beyond fintech into CRM / projects / admin / content / analytics.

- [x] **Rich built-in types**: `progress`, `rating`, `tags`, `badge`, `boolean`,
  `avatar` — all themed from the design tokens. New **Team** demo.

## 0.10 · Conditional formatting — done

The analytics & reporting layer — visual cues painted into the cells themselves,
adding nothing to the core for grids that don't opt in.

- [x] **Data bars** (`col.dataBar`): in-cell bars behind values, auto-ranged over
  the view (or explicit `min`/`max`); diverge around a zero baseline for signed
  columns; `color`/`negative` overrides.
- [x] **Icon sets** (`col.icons`): threshold-driven icon beside the value, each
  rule with a semantic `tone`. **Portfolio** demo shows both on Mkt Value / P&L.

## 0.11 · Colour scales — done

Completes the conditional-formatting trio (data bars + icon sets + colour scales).

- [x] **Colour scales** (`col.colorScale`): cell-background heat ramp across the
  value range, auto-ranged over the view (or explicit `min`/`max`); 2-stop, or
  3-stop diverging via `mid`; `colors` overrides the stops. Soft/translucent by
  default; works on any numeric column (complements the fixed `heatmap` type).
  **Portfolio** P&L % now uses an auto-ranged diverging scale.

## 0.12 · Computed columns — done

- [x] **Computed columns** (`col.value: (row) => …`): derive a column's value from
  the whole row (KPIs, ratios, deltas). Flows through display, sort, filter,
  group/footer aggregation, conditional formatting, export and copy. Not editable;
  in-memory mode. **Portfolio** adds a derived Cost Basis column.

## 0.13 · More rich types — done

- [x] **`link`** (anchor, `href(row)`, `newTab`, sanitized), **`relative`**
  (epoch ms → "3 hours ago"), **`currency`** (localized via `Intl.NumberFormat`).
  Exported `relativeTime` / `fmtCurrency`. **Team** demo shows all three.

## 0.14 · Charts companion — done

- [x] **`bo-grid/charts`** subpath: `LineChart`/`BarChart`/`DonutChart`, SVG,
  dependency-free, ~2 KB gzip on its own budget — **nothing added to the grid
  core**. Themeable via props or `--boc-*` vars; geometry helpers exported. New
  **Dashboard** demo (KPI cards + charts inside grid cells).

## 0.15 · Accessibility (WCAG 2.1 AA) — done

- [x] Audit + fixes: keyboard-navigable menus (APG pattern, focus return), a
  keyboard path to filtering (column-menu **Filter…**), visible `:focus-visible`
  rings on every reachable control. Verified ARIA grid/treegrid semantics,
  reduced-motion guards, `aria-live` loading, and AA contrast (no token changes
  needed). New **ACCESSIBILITY.md**.

## 0.16 · Scale — column virtualization — done

- [x] **Column (horizontal) virtualization** (`virtualizeColumns`): render only the
  columns in the horizontal window (+ overscan) for 100+ column grids; off-window
  runs collapse into spacers; pinned columns always render. Pure windowing math in
  `colvirt.ts`. New **Wide** demo. Core budget recalibrated 28 → 32 KB.

## 0.17 · Server-side / lazy tree loading — done

- [x] **Async tree children** (`loadChildren` + `hasChildren`): load a node's
  children on expand (server-backed trees), with a loading row and a children
  cache. Sync `getChildren` unchanged. New **Lazy tree** demo. (`buildTreeRows`
  generalized to a pure `TreeAccess` resolver; unit-tested.)

## 0.18 · More theme presets — done

- [x] Four new presets — `highContrastDark`/`highContrastLight` (a11y), `midnight`,
  `terminal` — plus `themePresets` map + `ThemePreset` type. New **Themes** demo.

## 0.19 · More charts — done

- [x] **`StackedBarChart`** (stacked/grouped multi-series), **`Legend`**, and SVG
  `<title>` **hover tooltips** on bar/stacked/donut — all in the companion (core
  untouched; charts ~3 KB). New stacked card in the **Dashboard** demo.

## 0.20 · Server-side (lazy) grouping — done

- [x] **`lazyGroups` + `loadGroup`**: server group summaries (count + aggregates)
  render as collapsed headers; each group's rows load on expand (loading row +
  cache), reusing the lazy-tree machinery. `buildLazyGroupRows` pure + tested.
  New **Server groups** demo.

## 0.21 · Framework-agnostic custom element — done

- [x] **`bo-grid/element`**: a `<bo-grid>` Web Component (Svelte compiled to a
  custom element, styles auto-injected, whole API via a `config` property) usable
  from **React, Vue, Angular and vanilla** — see [React, Vue & more](https://bonguynvan.github.io/bo-grid/docs/frameworks/).
  `wc-smoke` gate verifies it registers + renders + reacts.

## 0.22 · CSV import — done

- [x] **`parseCSV` / `parseCSVMatrix`**: round-trip the CSV export — RFC4180-aware
  parse into `GridRow`s (header→column mapping, numeric/date coercion). New **CSV
  import** demo.

## 0.23 · TSV & JSON import — done

- [x] **`parseTSV`** (tab-delimited), **`rowsFromObjects`** (plain objects → rows),
  **`parseJSON`** (JSON array → rows). The **CSV import** demo switches CSV/TSV/JSON.

## 0.24 · Print / export view — done

- [x] **`toHTMLTable`** (all rows → semantic, escaped `<table>`) + **`printTable`**
  (print window + dialog). Closes the "can't print a virtualized grid" gap. New
  **Print** demo.

## 0.25 · Smart import — done

- [x] **`parseRows`**: auto-detect JSON / TSV / CSV and parse to rows — ideal for a
  paste handler. **CSV import** demo gains an Auto-detect option.

## 1.1 · Realtime, properly — done

The trading-desk wave. bo-grid already claimed "realtime"; this makes the claim
structural rather than something every consumer re-implements.

- [x] **Derived per-cell flash** (`col.flash: 'auto' | 'change'`, `col.flashMs`):
  the grid tracks each cell's last value and flashes green up / red down by
  itself — no `flashSeq` bookkeeping, and independent per column within a row
  (bid green while ask goes red). Keyed on (row id, column) so recycled cells
  don't flash on scroll. `flash: true` stays as the legacy row-driven mode.
- [x] **`bo-grid/realtime`** — `createTickStream` / `TickBuffer` /
  `createRowIndex` / `applyPatches`: coalesce a feed per key, drain a bounded
  slice per frame, apply patches in O(1) skipping unchanged fields. A separate
  entry on its own 2 KB budget; the core is untouched.
- [x] **Realtime benchmarks** + live ticks/sec and queue depth in the demo.

## 1.2 · Market conventions — done

The APAC-broker differentiator: the ceiling/floor/reference colour convention
every VN/TH terminal uses and no generic grid ships, plus the formatting and
session-state plumbing that goes with it. Pure functions, no `ColumnDef`/Grid/Cell
changes — wired up through the `cell`/`render` hook you already have, so a
consumer who doesn't import `bo-grid/trading` pays nothing.

- [x] **Price-limit tone** (`resolveTone`, `toneColor`): classify a value
  against `{ ref, ceiling?, floor? }` → `'ceiling' | 'floor' | 'ref' | 'up' |
  'down'`, with a default (overridable) purple/cyan/yellow/green/red palette.
  `ceiling`/`floor` are optional, so the same function works for any market's
  limit-price rule, or none.
- [x] **Vietnam bands** (`vnBands`, `vnTickSize`, `vnBandPercent`,
  `roundToTick`): HOSE's price-step schedule and HOSE/HNX/UPCOM's daily band
  widths (7%/10%/15%) — ceiling rounded down to a tradable tick, floor rounded
  up, so neither exceeds the true regulatory limit.
- [x] **Tick-aware price formatting** (`fmtTradingPrice`, `decimalsForTick`):
  decimals derived from the instrument's tick size — 0 for whole-VND, 4 for an
  FX pip — instead of the built-in `price` type's fixed 2.
- [x] **Session state** (`sessionStateAt`, `VN_HOSE_SCHEDULE`, `sessionLabel`):
  ATO/continuous/break/ATC/closed, evaluated via `Intl` in the exchange's own
  time zone so it's correct for a viewer anywhere.
- [x] **`bo-grid/trading`** — a separate entry on its own 2 KB budget; the core
  is untouched. New **VN board** demo, composing it with `bo-grid/realtime`.

## 1.3 · Trading surfaces — done

The two live-desk surfaces a generic grid can't give you out of the box — both
pure math/data-structure, added to `bo-grid/realtime` (order-book and
trade-stream handling, not APAC-specific, so they stay out of `bo-grid/trading`)
with no Grid/Cell changes.

- [x] **Price ladder windowing** (`centeredWindow`): the `[start, end)` slice of
  `visibleCount` contiguous levels centred on a given index, clamped to bounds.
  Centring becomes array slicing — feed `<Grid rows>` a different window each
  tick instead of fighting virtual scroll to physically scroll to a position.
  "Scroll-lock" (follow the market vs. hold position) is documented as
  component-level UI state, not something the helper decides. New **Price
  ladder** demo: 120 levels, 16 visible, page + recenter.
- [x] **`TradeTape`**: a capped, append-only ring buffer for a time & sales
  feed — O(1) `push` regardless of session length (a true ring, not
  shift-and-truncate), `toArray()` a newest-first snapshot. The opposite
  discipline from `TickBuffer`: nothing coalesces, every trade shows. New
  **Time & sales** demo.
- [x] Fits inside realtime's existing 2 KB budget (now ~1.67/2 KB, ~84%) — the
  next realtime feature should recalibrate it.

## 1.4 · Candlestick & depth charts — done

The last piece of the trading-desk wave: the two chart shapes a trading
dashboard needs, in the existing `bo-grid/charts` companion. Pure SVG
geometry (`candleGeometry`, `depthBars`) alongside the existing
`linePoints`/`barRects`/`donutArcs`, so the pattern of thin component over
tested geometry holds for these too.

- [x] **`CandlestickChart`**: OHLC candlesticks from the same `Candle` type the
  grid's own `sparkline` column already uses — body open→close, wick
  high→low, coloured by direction.
- [x] **`DepthChart`**: order-book depth from raw per-level sizes (nearest-to-
  spread first — the cumulative sum is computed for you, not pre-summed by
  the caller). Bids fill outward left, asks outward right, **one shared
  vertical scale** across both sides so a lopsided book doesn't let the thin
  side visually fill the chart.
- [x] Charts budget recalibrated 3 → 4 KB for both (now ~4.2/8 KB). Dashboard
  demo gets two more cards.

## 2.0 · Grid-only, built for busy markets — done

bo-grid becomes a pure data grid, aiming at a complete feature set for trading
and data-heavy screens. Standalone charting moves out: the
[TradeCanvas](https://github.com/bonguynvan/tradecanvas) library covers it.

- [x] **Removed `bo-grid/charts`** (breaking). In-cell sparklines stay — they
  are a column type, part of the grid.
- [x] **Localization** — `labels` (every built-in string, overridable per grid)
  and `locale` (built-in number/date/relative formatting).
- [x] **Grid handle** — `onReady(api)`: `scrollToRow`, `focusCell`,
  `getSelectedRows`, `autosizeColumns`, `exportCSV`, `getState`/`applyState`
  with saved-layout reconciliation.
- [x] **Merged cells** — value-driven `spanRows` (hierarchical) and row-driven
  `colSpan`, virtualization- and pin-aware.
- [ ] **Explicit merge regions** — key-addressed rectangles for layout facts
  no rule derives (block trades, report captions).
- [x] **Cell-type registry** — `cellTypes` + `cellType: 'name'`, with
  `extends` for built-in behaviour and a Svelte `component` renderer.
- [x] **Custom filter types** — `filterTypes` + `filter: 'name'`, editor drawn
  inside the standard menu frame.
- [ ] **Layered source layout** — split the grid into pure `core/`, runes
  `reactive/` and `ui/` tiers with an enforced import rule. *(moved to 2.1)*
- [x] **Busy-market performance**, measured on a VN-style price board
  (production build, same-session A/B): `api.patchRows` on plain rows with
  per-field repaints, flashes that never rebuild DOM, row recycling and reused
  render items for scrolling (3.5–9× cheaper), `api.refresh()` with sort keys
  read once per row for live re-sorts, `flashColor: false` for price-limit tones.
- [x] **Layout fixes** — header/body alignment to the subpixel, flex fill in
  fixed-width mode, horizontal scroll instead of clipping.
- [x] **New demo site** — a trading broadsheet with a live price board as its
  lead figure.

Remaining 2.0 ideas (explicit merge regions, layered source layout) and the
feature backlog below move to **2.1+**.

### Feature backlog, in priority order

What data-heavy screens most often need that bo-grid does not have yet:

1. [x] **Custom cell editors** (`editor` component), a value parser for typed
   and pasted text (`parse`), and `defaultColumn` for shared column settings.
2. [ ] **Two-condition column filters** — `A and/or B` inside the text, number
   and date filters.
3. [ ] **Row grouping from the UI** — "Group by this column" in the column
   menu and a drag-to-group panel, with removable group chips.
4. [ ] **Collapsible header groups** — a header group that folds to one column.
5. [ ] **Bottom pinned rows** — `pinnedBottomRows` beside `pinnedRows`.
6. [ ] **Status bar** — row counts (total / filtered / selected) next to the
   selection aggregates.
7. [ ] **Find in grid** — Ctrl/⌘+F highlight and step through matches.
8. [ ] **Auto row height** — measure wrapped content per row.
9. [ ] **Explicit merge regions** (above) and **multiple selection ranges**.
10. [ ] **RTL layout.**

Already shipped: virtual rows/columns, pinning, sort/filter (text, number,
date, set, custom), quick filter, floating filter row, grouping with
aggregation, tree data (incl. lazy), master-detail, pivot, server-side rows,
inline editing with undo/redo, fill handle, clipboard, CSV/Excel export,
column move/resize/autosize/hide, tool panel, merged cells, cell renderers and
registered types, sparklines, cell flash, themes, localization, keyboard and
ARIA, state save/restore.

## Candidate themes for later versions

The roadmap's planned features are all shipped, plus cross-framework support and
CSV round-trip. Remaining ideas are polish or demand-driven:

- **Polish** — a live screen-reader + axe-core pass; framework starter repos;
  multi-level lazy groups; custom-cell bridging for the Web Component.
- Driven by real-world usage now that it's published — open an issue with what's
  missing.

Note on size: the eager core is ~40 KB gzip. Feature growth is expected as the
feature set fills out and is not capped; `pnpm size:lib` reports the
number on every run so optimization has a target, and only fails on an
accidental blow-up. The
realtime (2 KB) and trading (2 KB) companions, each on its own budget, are the
model for keeping the core tiny — a new capability belongs in a
subpath unless it is genuinely part of the grid's identity.

Out of scope by design (they fight the "tiny" positioning): any
charting engine (use TradeCanvas alongside the grid),
viewport row model, RTL — unless real demand appears.

Ideas and feedback welcome — open an issue.
