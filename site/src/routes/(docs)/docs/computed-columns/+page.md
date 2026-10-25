---
title: Computed columns
description: Derive a column's value from the whole row, such as a total, a ratio or a P&L, and sort, filter, total and export it like any other column.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

A computed column derives its value from the row instead of reading a field. Give the column a `value(row)` function: the result is shown, sorted, filtered, totalled, formatted conditionally, copied and exported exactly like a stored value. Use it for KPIs, ratios and deltas you would otherwise have to precompute and keep in sync.

Value and P&L below exist on no row; sort by either, and see the footer total them:

<Example name="computed-columns" title="Value and P&L derived per row" />

## Defining one

```ts
const columns: ColumnDef[] = [
  { type: 'number', key: 'qty', header: 'Qty', decimals: 0 },
  { type: 'price', key: 'last', header: 'Last' },
  // No `value` field on the rows: derived, and still sortable and exportable.
  { type: 'number', key: 'value', header: 'Value', decimals: 0, groupAgg: 'sum', value: (r) => Number(r.qty) * Number(r.last) },
];
```

- `key` still names the column: sorting, filtering, hiding and saved layouts refer to it. It does not have to be a real field on the row.
- The column's `type` formats the result, so a computed price uses `type: 'price'`.
- `groupAgg` totals it on [group rows](../grouping/) and in the grid's `footer`.

## Rules

- **Keep it cheap and pure.** `value()` runs while sorting and filtering, not only when a cell draws. Read the row and return a value; don't fetch or mutate anything.
- **It is read-only.** There is no field to write an edit back to, so computed columns are not editable.
- **In memory only.** With a server [data source](../server-data/), the server computes its own derived fields.

## Reference

<Props of="column" names={['value', 'groupAgg', 'format']} />

<Props names={['footer']} />
