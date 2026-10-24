---
title: Merged cells
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

**Down — `spanRows`.** Merge a column's cell over adjacent rows that hold the
same value — the blotter case, where account, order and symbol repeat down every
fill and the repetition hides the boundaries you are looking for:

```ts
const columns: ColumnDef[] = [
  { type: 'text',  key: 'account', header: 'Account', width: 110, spanRows: true },
  { type: 'text',  key: 'order',   header: 'Order',   width: 104, spanRows: true },
  { type: 'text',  key: 'symbol',  header: 'Symbol',  width: 84,  spanRows: true },
  { type: 'text',  key: 'time',    header: 'Time',    width: 80 },
  { type: 'price', key: 'price',   header: 'Price',   flex: 1 },
];
```

`true` joins rows whose values are equal (blank values never merge). Pass a
comparator to decide per adjacent pair instead — e.g. the same calendar day:

```ts
{ type: 'date', key: 'filledAt', header: 'Day', spanRows: (a, b) => sameDay(a.filledAt, b.filledAt) }
```

- **Hierarchical, in display order.** A run also breaks wherever a spanning
  column to its left breaks, so a symbol never merges across two accounts.
  Reordering columns reorders the hierarchy.
- **Only adjacent rows merge**, so it follows the current sort: sort by the
  merged column for the biggest merges. Group headers, tree placeholders and an
  expanded detail row break every run.
- **A drawing rule, not a data change.** Every row keeps its value: sort,
  filter, copy, CSV/Excel export and `toHTMLTable` see one value per row.
- Merged cells are not editable; selecting any row in a run highlights the cell.
- In-memory mode only (a `source` sees one window at a time). Like sort and
  filter, runs are recomputed when the view changes, not on every realtime tick.

**Across — `colSpan`.** Return how many columns a cell covers for a given row;
the covered columns are not drawn. A note row spanning the fill columns:

```ts
{ type: 'text', key: 'time', header: 'Time', width: 80,
  colSpan: (row) => (row.note ? 3 : 1),
  format: (v, row) => (row?.note ? row.note : String(v)) }
```

The leftmost claim wins; a span is clamped at the last column and at a
pinned/scrolling boundary. A covered cell breaks the `spanRows` run of the
column it covers, but not of a column to its left. Combined on one column, a
run only continues while the rows below span the same width. `colSpan` is
ignored under `virtualizeColumns`. See the **Blotter** example.

The planning is a pure function, `buildMergePlan(...)` / `colSpanRow(...)`,
exported for anything that renders its own view of the same rows.

## Live example

<Example id="blotter" />
