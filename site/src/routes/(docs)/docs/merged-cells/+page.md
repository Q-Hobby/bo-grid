---
title: Merged cells
description: Merge repeated values down a column, or let a cell span several columns, without changing the data underneath.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Merged cells remove repetition that hides structure. On a blotter, the account, order and symbol repeat down every fill; merged, each shows once, and the order boundaries stand out. A cell can also span columns to the right, for a note that needs the room. Merging changes only what is drawn: every row keeps its own values.

Account, order and symbol merge down their runs; the note row spans the Qty and Price columns:

<Example name="merged-cells" title="Merging down and across" />

## Down a column: spanRows

`spanRows: true` merges a cell over adjacent rows with the same value. Blank values never merge.

```ts
const columns: ColumnDef[] = [
  { type: 'text', key: 'account', header: 'Account', width: 100, spanRows: true },
  { type: 'text', key: 'order', header: 'Order', width: 96, spanRows: true },
  { type: 'text', key: 'symbol', header: 'Symbol', width: 84, spanRows: true },
  { type: 'text', key: 'time', header: 'Time', width: 90 },
  { type: 'price', key: 'price', header: 'Price', flex: 1 },
];
```

To decide per pair of adjacent rows instead, pass a function, for example to merge dates on the same calendar day:

```ts
{ type: 'date', key: 'filledAt', header: 'Day', spanRows: (a, b) => sameDay(a.filledAt, b.filledAt) }
```

- **Hierarchical, in display order.** A run also breaks wherever a merging column to its left breaks, so a symbol never merges across two accounts. Moving columns changes the hierarchy.
- **Only adjacent rows merge**, so merging follows the current sort: sort by the merged column for the largest merges. Group headers, tree placeholders and an expanded detail row break every run.
- **A drawing rule, not a data change.** Sorting, filtering, copying, CSV and Excel export, and `toHTMLTable` all see one value per row.
- A merged cell is not editable. Selecting any row in a run highlights the cell.
- Runs are recomputed when the view changes, like sorting and filtering, not on every realtime tick.

## Across columns: colSpan

`colSpan(row)` returns how many columns a cell covers in that row; the covered cells are not drawn. A note row, for example, can cover the fill columns:

```ts
{
  type: 'text',
  key: 'qtyText',
  header: 'Qty',
  value: (r) => r.note ?? String(r.qty),
  colSpan: (r) => (r.note ? 2 : 1),
}
```

- The leftmost claim wins when spans overlap.
- A span stops at the last column and at the edge between pinned and scrolling columns.
- A covered cell breaks the `spanRows` run of the column it covers, but not of a column to its left. On one column with both, a run continues only while the rows below span the same width.
- `colSpan` is ignored when `virtualizeColumns` is on.

## Both are in memory only

Merging needs neighbouring rows, so it applies to rows in memory. With a server [data source](../server-data/), which holds one window of rows at a time, cells don't merge.

The planning is a pure function, `buildMergePlan(...)` with `colSpanRow(...)`, exported for anything that draws its own view of the same rows.

## In the gallery

A trade blotter with merged account, order and symbol runs, and note rows across the fill columns:

<Example id="blotter" />

## Reference

<Props of="column" names={['spanRows', 'colSpan']} />
