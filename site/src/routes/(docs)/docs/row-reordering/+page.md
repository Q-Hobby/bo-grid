---
title: Row reordering
description: Let users drag rows into their own order with a handle, for task lists, watchlists and priorities.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Row reordering adds a drag handle to the first column, so users can put rows in their own order: a task list, a watchlist, a priority queue. The grid reports where a row was dropped, and your app moves it in its own array.

Grab the ⠿ handle at the start of a row and drop it on another row:

<Example name="row-reordering" title="Drag to reorder tasks" />

## Turning it on

Pass `onRowReorder`. It receives the row's old and new positions in the rows on screen; move the row in your array and assign a new array:

```svelte
<script lang="ts">
  let tasks: GridRow[] = $state([
    { id: 1, title: 'Write the brief' },
    { id: 2, title: 'Review the pull request' },
  ]);

  function reorder(from: number, to: number): void {
    const next = [...tasks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    tasks = next;
  }
</script>

<Grid rows={tasks} {columns} onRowReorder={reorder} height={480} />
```

## When it applies

The positions are indices into the rows on screen, so they match your array only when the view shows it as it is:

- **Unsorted and unfiltered.** Make the columns `sortable: false`, as in the example, and don't filter a reorderable list. A sorted view would put the dropped row back in sort order anyway.
- **Flat, in memory, one page.** The handle does not appear with grouping (`groupBy`), tree data, a server data source, or paging (`pageSize`).

## In the gallery

<Example id="tasks" />

## Reference

<Props names={['onRowReorder']} />

<Props of="column" names={['sortable']} />
