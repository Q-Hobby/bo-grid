---
title: Server-side data
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

Instead of an in-memory `rows` array, back the grid with a **`RowSource`** — the
grid requests only the visible window (plus overscan), so the dataset can be far
larger than memory. Sort and filter are delegated to the source; unloaded rows
render as skeletons.

```svelte
<script lang="ts">
  import { Grid, createArraySource, type RowSource } from 'bo-grid';

  // Your own source: fetch a window from the server.
  const source: RowSource = {
    async getRows({ range, sort, filter }) {
      const res = await fetch(`/api/rows?offset=${range.start}&limit=${range.end - range.start}` +
        `&sort=${sort?.key ?? ''}&dir=${sort?.dir ?? ''}&q=${filter}`);
      return res.json(); // { rows, total }
    },
  };
</script>

<Grid {columns} {source} height={640} />
```

`createArraySource(rows, { latency, filterKeys })` adapts an in-memory array to
the same interface (handy for testing the path or client-side data). Grouping is
client-only, so it's not applied in source mode.

## Live example

<Example id="bigdata" />
