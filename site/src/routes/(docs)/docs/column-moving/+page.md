---
title: Moving & hiding
description: Let users drag columns into a new order and hide or show them from a column menu or a Columns panel, or drive visibility from your own UI.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Users can drag a column header to move the column, and hide or show columns from a per-column menu or a Columns panel. Your app can also hide columns itself through `hiddenColumns`, and the grid reports every change so you can save it.

Drag a header sideways to move its column. Open a header's ⋮ menu to sort, pin, autosize or hide it, and use the Columns button to bring hidden columns back:

<Example name="column-moving" title="Moving and hiding columns" />

## Moving columns

Drag any column header to a new position. `onColumnReorder` receives the new order of column keys, and `persistKey` remembers it across reloads (in `localStorage`):

```svelte
<Grid {rows} {columns} persistKey="watchlist" onColumnReorder={(keys) => (columnOrder = keys)} height={480} />
```

The `columns` array you pass keeps its own order; the user's order is layered on top. `api.getState()` and `api.applyState()` capture and restore it along with widths, pins, sorts and filters (see [Grid API](../grid-api/)).

## The column menu

`columnMenu` adds a ⋮ button to each header, also opened with <kbd>Alt</kbd>+<kbd>↓</kbd> on the focused column. It offers:

- **Sort** ascending or descending.
- **Pin** left or right, or unpin (see [Pinned columns](../pinned-columns/)).
- **Autosize**: fit the column to its content.
- **Hide column**.
- **Filter**, when the grid also has `filterMenu` (see [Sorting & filtering](../sorting-filtering/)).

## The Columns panel

`columnsPanel` adds a Columns button that opens a checklist of every column, to hide and show them. It is the place to bring back a column hidden from the menu.

```svelte
<Grid {rows} {columns} columnMenu columnsPanel height={480} />
```

## Hiding columns from your app

`hiddenColumns` takes the keys of columns to hide. It is controlled: build your own column picker and drive the prop. Columns the user hides at runtime are added to it, and `onColumnVisibilityChange` reports the full set of hidden keys whenever it changes:

```svelte
<script lang="ts">
  let hidden = $state(['bonus', 'rating']);
</script>

<Grid {rows} {columns} hiddenColumns={hidden} columnMenu onColumnVisibilityChange={(keys) => (hidden = keys)} height={480} />
```

Runtime hides and pins are remembered under `persistKey` too.

## Reference

<Props names={['onColumnReorder', 'columnMenu', 'columnsPanel', 'hiddenColumns', 'onColumnVisibilityChange', 'persistKey']} />

<Props of="api" names={['getState', 'applyState']} />
