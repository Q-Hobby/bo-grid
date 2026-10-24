---
title: Sorting & filtering
description: TODO
---

Click a column header to sort (asc → desc → off). **Shift-click** additional
headers to sort by multiple columns — each sorted header shows its position in
the order. Sparkline columns aren't sortable; set `sortable: false` on any column
to opt out. Sorting is a snapshot — rows hold position while their values update
in place (trading-grid behaviour), so a realtime feed never reshuffles the view.

Pass a `filter` string to quick-filter rows (matches across column values). Drive
it from your own search input — or set `quickFilter` for a **built-in search box**
above the grid. Set `filterRow` to add a row of **per-column filter inputs** under
the header (rows must match every non-empty column filter; in-memory mode).

For richer filtering, set `filterMenu` to add a **funnel to each column header**.
Clicking it opens a menu whose control matches the column type — text
(contains / equals / starts / ends), number (`=, ≠, <, ≤, >, ≥, between`), or date
(before / after / on / between — whole calendar days in the viewer's time zone,
the same day the cell shows). Set `col.filter: 'set'` for a **set filter** — a
searchable checkbox list of the column's distinct values (All / None). The menu
is lazy-loaded on first open, so it costs nothing until used; disable it per
column with `col.filter: false`:

```svelte
<Grid {rows} {columns} height={640} filterMenu />
```

Filtering is uncontrolled by default. To **own the filter state** (persist it, set
initial filters, sync to the URL), pass a controlled `columnFilters` map and
handle `onFilterChange` — mirrors controlled `sort`. In **server (`source`) mode**
the filter menu still works: text/number/date filters are delegated to your
`RowSource` via `params.columnFilters` (set filters need in-memory data).
