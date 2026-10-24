---
title: Server-side grouping
description: Show groups summarised on the server, and load each group's rows only when it is expanded.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

When the data is grouped on the server, or is too large to send up front, give the grid the group summaries (`lazyGroups`) and a function that loads a group's rows (`loadGroup`). The grid shows the groups at once, with the counts and totals the server sent, and fetches a group's rows the first time it is opened.

Expand a region: a loading row shows while its orders arrive, then they stay loaded.

<Example id="servergroups" />

## Group summaries and loading

```svelte
<script lang="ts">
  import { Grid, type LazyGroup } from 'bo-grid';

  const lazyGroups: LazyGroup[] = [
    { key: 'North America', count: 142, agg: { amount: '$2.4M' } },
    { key: 'Europe', count: 98, agg: { amount: '$1.8M' } },
  ];
  const loadGroup = (key: string) => fetch(`/api/orders?region=${encodeURIComponent(key)}`).then((r) => r.json());
</script>

<Grid rows={[]} {columns} height={520} {lazyGroups} {loadGroup} />
```

Each `LazyGroup` has:

| Field | Meaning |
| --- | --- |
| `key` | The group's id, passed to `loadGroup` |
| `label` | The header text (defaults to `key`) |
| `count` | The row count shown on the header |
| `agg` | Preformatted totals by column key, shown on the header under that column |

`loadGroup(key)` returns a promise of the group's rows. While it runs the group shows a loading row; the rows are kept once loaded, so closing and reopening a group does not fetch again.

The totals come from the server as strings, already formatted, because the grid has not seen the rows they sum. For groups computed in the browser from rows you already have, use [Row grouping](../grouping/).

## Reference

<Props names={['lazyGroups', 'loadGroup']} />
