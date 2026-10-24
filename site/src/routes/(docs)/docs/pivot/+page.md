---
title: Pivot tables
description: Turn flat rows into a pivot table, with row groups down the side, one column per value of a field, and an aggregate in each cell.
---

<script>
  import Example from '$lib/Example.svelte';
</script>

`pivot()` turns flat rows into a pivot table: it groups rows by one or more fields, spreads the values of another field into columns, and aggregates a measure into each cell. It returns ordinary `rows` and `columns`, so the result goes straight into `<Grid>` with sorting, selection and export working as usual.

Trades by desk and book, one column per month plus a Total, in thousands. Change the aggregate to recompute every cell.

<Example name="pivot" title="Notional by desk and month" />

## Building a pivot

```svelte
<script lang="ts">
  import { Grid, pivot } from 'bo-grid';

  const table = $derived(
    pivot(trades, {
      rowFields: ['desk', 'book'], // leading text columns, one row per combination
      columnField: 'month',        // each distinct month becomes a column
      measure: 'notional',         // the numeric field aggregated into the cells
      agg: 'sum',
    }),
  );
</script>

<Grid rows={table.rows} columns={table.columns} height={480} />
```

`pivot` is a pure function of its input. Call it once for a snapshot, or in `$derived` (as above) so the table follows the data and the settings.

## Options

| Option | Meaning |
| --- | --- |
| `rowFields` | Fields to group rows by (at least one); each becomes a leading text column |
| `columnField` | The field whose distinct values become columns, in sorted order; omit it for a single value column |
| `measure` | The numeric field to aggregate |
| `agg` | `'sum'` (default), `'avg'`, `'count'`, `'min'` or `'max'` |
| `decimals` | Decimal places for the value columns (default 0) |
| `totals` | Append a Total column across all column values (default `true`) |

## Pivot or grouping?

A pivot reshapes the data into a new table with a column per value, which suits a report: months across, desks down. To keep the original rows and columns and fold them into collapsible sections with subtotals, use [Row grouping](../grouping/).

## Reference

`pivot(source, config)` returns `{ rows, columns }` (`PivotResult`). Its config is the `PivotConfig` type above.
