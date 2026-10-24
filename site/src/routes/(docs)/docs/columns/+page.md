---
title: Column definitions
description: TODO
---

```svelte
<script lang="ts">
  import { Grid, type ColumnDef, type GridRow } from 'bo-grid';

  const columns: ColumnDef[] = [
    { type: 'text',      key: 'symbol', sub: 'sector', header: 'Symbol', width: 132 },
    { type: 'price',     key: 'price',  header: 'Price', width: 88, flash: 'auto' },
    { type: 'percent',   key: 'changePct', header: 'Chg %', width: 84 },
    { type: 'heatmap',   key: 'changePct', header: 'Heat', min: -5, max: 5, width: 76 },
    { type: 'volume',    key: 'volume', header: 'Volume', width: 90 },
    { type: 'date',      key: 'listedAt', header: 'Listed', dateStyle: 'short', width: 92 },
    { type: 'sparkline', key: 'candles', sparkKey: 'candles', header: 'Trend', flex: 1 },
  ];

  // Rows must expose `id` plus your data fields.
  // Make the hot fields `$state` so updates flash without re-rendering the table.
  let rows: GridRow[] = $state(/* ... */);
  let filter = $state(''); // bind to your own search input
</script>

<Grid {rows} {columns} {filter} height={640} />
```
