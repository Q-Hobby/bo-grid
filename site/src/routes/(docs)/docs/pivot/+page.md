---
title: Pivot tables
description: TODO
---

`pivot()` transforms flat rows into a pivot table (rows + dynamic columns) you
hand straight to `<Grid>` — group by row fields, spread a field's values into
columns, and aggregate a measure into each cell:

```svelte
<script lang="ts">
  import { Grid, pivot } from 'bo-grid';

  const { rows: pivotRows, columns: pivotColumns } = pivot(data, {
    rowFields: ['sector'],     // → leading text columns
    columnField: 'exchange',   // distinct values → columns (+ a Total)
    measure: 'volume',
    agg: 'sum',
  });
</script>

<Grid rows={pivotRows} columns={pivotColumns} height={640} />
```

It's a pure function, so call it as a snapshot or reactively as you prefer.
