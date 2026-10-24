---
title: Row grouping
description: Group rows by one or more columns into collapsible sections with live subtotals on each group header.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

`groupBy` groups the rows by the values of one or more columns: a portfolio by sector, orders by desk and then by trader. Each group has a header row that collapses it and shows subtotals for the columns that ask for one, and the subtotals stay current while the values tick.

Click a group header to collapse it. The headers show the average price and change and the total volume of their rows.

<Example name="grouping" title="Grouped by sector" />

## Grouping

Pass the column keys to group by, outermost first:

```svelte
<Grid {rows} {columns} height={480} groupBy={['sector']} />
<Grid {rows} {columns} height={480} groupBy={['sector', 'exchange']} /> <!-- nested -->
```

`groupBy` is a prop like any other: change it and the grid regroups. Grouping is for in-memory rows; for data grouped on a server, see [Server-side grouping](../server-grouping/).

## Subtotals

Give a column a `groupAgg` (`'sum'`, `'avg'`, `'count'`, `'min'` or `'max'`) and every group header shows that aggregate of the column over the group's rows:

```ts
const columns: ColumnDef[] = [
  { type: 'text', key: 'symbol', header: 'Symbol' },
  { type: 'price', key: 'price', header: 'Avg price', groupAgg: 'avg' },
  { type: 'volume', key: 'volume', header: 'Volume', groupAgg: 'sum' },
];
```

The same `groupAgg` drives the grand-total row when `footer` is on; see [Cell selection & clipboard](../selection/).

## Large grouped sets

Group headers are as tall as data rows, so a grouped grid virtualizes like a flat one and scrolls smoothly over many thousands of rows. While you scroll inside a group, its header stays pinned to the top, so you always know which group you are in. Subtotals recompute as a live feed changes values.

## A grouped portfolio

Positions grouped by sector, with live subtotals and a P&L heatmap:

<Example id="portfolio" />

## Reference

<Props names={['groupBy', 'footer']} />

<Props of="column" names={['groupAgg']} />
