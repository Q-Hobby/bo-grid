---
title: Row selection
description: Add a checkbox column for selecting whole rows, keyed by row id so the selection survives sorting, filtering and live updates.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Row selection adds a leading checkbox column for picking whole rows, for example to act on several orders at once. The selection is a set of row ids, not positions, so it survives sorting, filtering and a live feed reordering rows. It is separate from [cell selection](../selection/), the range a user drags over cells.

Tick a few rows, then sort a column: the same rows stay ticked. The header checkbox selects or clears every row that matches the current filter.

<Example name="row-selection" title="Checkbox row selection" />

## Turning it on

```svelte
<script lang="ts">
  let selected = $state<Array<string | number>>([]);
</script>

<Grid {rows} {columns} rowSelection onRowSelectionChange={(ids) => (selected = ids)} height={480} />
```

- Click a checkbox, or press <kbd>Space</kbd> on the focused row.
- The header checkbox selects or clears all rows that pass the current filters.
- `onRowSelectionChange` receives the selected ids whenever the set changes.
- `api.getSelectedRows()` returns the ticked rows themselves, in view order.

## Row ids

Selection is keyed by `row.id`. If your rows are identified by another field, such as a UUID or a composite key, pass `getRowId`:

```svelte
<Grid {rows} {columns} rowSelection getRowId={(r) => String(r.uuid)} height={480} />
```

## One active row

For a list-and-detail layout, where one row is "open", use `selectedRowId` instead. It highlights a single row, is fully controlled by your app, and is independent of the checkboxes. Pair it with `onRowClick`:

```svelte
<Grid {rows} {columns} selectedRowId={openId} onRowClick={(r) => (openId = r.id)} height={480} />
```

## With server data

With a server [data source](../server-data/), the checkboxes work on loaded rows. The header checkbox is disabled, because ids of rows that are not loaded cannot be listed.

## Reference

<Props names={['rowSelection', 'onRowSelectionChange', 'getRowId', 'selectedRowId', 'onRowClick']} />

<Props of="api" names={['getSelectedRows']} />
