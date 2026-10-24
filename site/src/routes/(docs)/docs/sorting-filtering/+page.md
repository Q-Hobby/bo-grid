---
title: Sorting & filtering
description: Sort by one or more columns, search across every column, and filter each column with a menu matched to its type.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Every column sorts from its header, and the grid has three ways to filter: a quick search across all columns, a row of per-column inputs, and a filter menu on each header. They combine: a row is shown when it passes all of them.

Click a header to sort, Shift-click another to add it to the sort, open a header's funnel to filter it (Sector has a checkbox list), or type in the search box.

<Example name="sorting-filtering" title="Sort and filter" />

## Sorting

Click a column header to sort it ascending, again for descending, and a third time to clear. **Shift-click** more headers to sort by several columns; each sorted header shows its place in the order.

- Numeric columns sort by number, dates by time, text with a locale-aware collator.
- Give a column `compare(a, b)` for a custom order (a status workflow, a rating scale).
- Set `sortable: false` to stop a column sorting. Sparkline columns never sort.

### A sort you own

Sorting is uncontrolled by default. To set an initial sort, persist it or sync it to the URL, pass `sort` and handle `onSortChange`:

```svelte
<script lang="ts">
  import { Grid, type SortState } from 'bo-grid';
  let sort = $state<SortState[]>([{ key: 'volume', dir: 'desc' }]);
</script>

<Grid {rows} {columns} height={480} {sort} onSortChange={(s) => (sort = s)} />
```

### Sorting live data

A sort is a snapshot: when values change in place (a price feed), rows keep their position, so a live board never reshuffles under the reader. Call `api.refresh()` when the order should catch up. With `api.patchRows`, `liveSort` keeps it current instead: rows whose sorted or filtered field changed are merged back into place at most every 500 ms (or the interval you give). See [Live updates](../realtime/).

## Quick search

Pass a `filter` string to keep only rows where some column's value contains it, ignoring case. Bind it to your own search input, or set `quickFilter` for a built-in search box above the grid (in-memory data; with a server source, pass `filter`):

```svelte
<script lang="ts">
  let q = $state('');
</script>

<input type="search" bind:value={q} placeholder="Search" />
<Grid {rows} {columns} height={480} filter={q} />
```

## Filter row

`filterRow` adds a row of inputs under the header, one per column. A row must match every input that has text. In-memory data only.

```svelte
<Grid {rows} {columns} height={480} filterRow />
```

## Filter menu

`filterMenu` adds a funnel to each header. Its menu matches the column type:

| Column | Operators |
| --- | --- |
| Text | contains, does not contain, equals, starts with, ends with |
| Number | `=`, `≠`, `<`, `≤`, `>`, `≥`, between |
| Date | before, after, on, between (whole days, in the viewer's time zone) |
| Set (`filter: 'set'`) | a searchable checkbox list of the column's distinct values |

Set `filter: false` on a column to leave it without a funnel. The menu's code loads on first open, so it costs nothing until it is used.

```ts
const columns: ColumnDef[] = [
  { type: 'text', key: 'sector', header: 'Sector', filter: 'set' },
  { type: 'price', key: 'price', header: 'Price' },          // number operators
  { type: 'text', key: 'note', header: 'Note', filter: false }, // no funnel
];
```

For a filter kind of your own (a band, a range rule), see [Custom filters](../custom-filters/).

### Filters you own

Like sorting, filtering is uncontrolled by default. Pass `columnFilters` (a map from column key to filter) and handle `onFilterChange` to set initial filters, save them or put them in the URL:

```svelte
<script lang="ts">
  import { Grid, type AnyFilter } from 'bo-grid';
  let filters = $state<Record<string, AnyFilter>>({
    change: { kind: 'number', op: 'gt', a: 0 },
    sector: { kind: 'set', excluded: ['Energy'] },
  });
</script>

<Grid {rows} {columns} height={480} filterMenu columnFilters={filters} onFilterChange={(f) => (filters = f)} />
```

A filter is a plain, JSON-safe object: `{ kind: 'text', op, q }`, `{ kind: 'number', op, a, b? }`, `{ kind: 'date', op, a, b? }` (epoch ms) or `{ kind: 'set', excluded }`.

## With a server source

With a `source`, the grid sends the sort, the `filter` text and the column filters to your `getRows` and shows what it returns. Text, number and date menus work as usual; a set filter needs the distinct values, so it is for in-memory data. See [Server-side data](../server-data/).

## Reference

<Props names={['sort', 'onSortChange', 'filter', 'quickFilter', 'filterRow', 'filterMenu', 'columnFilters', 'onFilterChange', 'liveSort']} />

<Props of="column" names={['sortable', 'compare', 'filter']} />

<Props of="api" names={['refresh']} />
