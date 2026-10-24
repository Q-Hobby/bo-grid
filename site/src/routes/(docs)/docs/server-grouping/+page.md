---
title: Server-side grouping
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

When the data is grouped on the server (or too large to fetch upfront), pass
**`lazyGroups`** (the group summaries) and **`loadGroup`** (load a group's rows on
expand). Headers show the server-provided count and preformatted aggregates; rows
load lazily with a loading row, then cache. See the **Server groups** example.

```svelte
<Grid
  rows={[]}
  {columns}
  lazyGroups={[
    { key: 'North America', count: 142, agg: { amount: '$2.4M' } },
    { key: 'Europe', count: 98, agg: { amount: '$1.8M' } },
  ]}
  loadGroup={(key) => fetch(`/api/orders?group=${key}`).then((r) => r.json())}
  height={520}
/>
```

## Live example

<Example id="servergroups" />
