---
title: Row grouping
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

Pass `groupBy` (column keys) to group rows — single or nested. Groups are
collapsible (click the header) and show **live subtotals** under any column with
a `groupAgg` set:

```svelte
<script>
  const columns = [
    { type: 'price',  key: 'price',  header: 'Price',  groupAgg: 'avg' },
    { type: 'volume', key: 'volume', header: 'Volume', groupAgg: 'sum' },
    // …
  ];
</script>

<Grid {rows} {columns} groupBy={['sector', 'exchange']} height={640} />
```

Group headers are the same height as data rows, so virtual scrolling stays smooth
over very large grouped sets. Subtotals recompute live as the feed ticks, and the
current group's header stays pinned to the top as you scroll within it.

## Live example

<Example id="portfolio" />
