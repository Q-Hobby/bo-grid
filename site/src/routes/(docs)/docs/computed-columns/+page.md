---
title: Computed columns
description: TODO
---

Derive a column's value from the whole row with `value: (row) => …` — KPIs,
ratios, deltas. The derived value flows through display, sort, filter, group/footer
aggregation, conditional formatting, export and copy, just like a real column.
`key` still names the column (and is the sort/filter key) but need not be a real
field. Computed columns aren't editable (there's no field to write back).

```ts
const columns: ColumnDef[] = [
  { type: 'number', key: 'qty',   header: 'Qty' },
  { type: 'price',  key: 'price', header: 'Price' },
  // No `total` field on the row — derived, and still sortable/filterable/exportable:
  { type: 'price',  key: 'total', header: 'Total', value: (row) => row.qty * row.price,
    groupAgg: 'sum' },
];
```

In-memory mode (a server `source` owns its own derivations). Keep `value()` cheap
and pure — it's called during sort and filter.
