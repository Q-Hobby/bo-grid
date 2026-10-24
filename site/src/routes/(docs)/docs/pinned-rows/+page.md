---
title: Pinned rows
description: Keep rows above the scroll, always in view, whether they are rows of your own or rows readers pin from the board.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

A pinned row stays above the scroll while the rest of the grid moves under it. Use it for a row that should never leave the screen: a benchmark, a summary, your position, or the symbols a reader is watching on a long board.

The INDEX row is passed in `pinnedRows`; pin others yourself with a right-click, or with the button, which calls the grid API.

<Example name="pinned-rows" title="Pinned rows" />

## Rows of your own

`pinnedRows` takes rows that are not in `rows`: they sit above the scroll, use the grid's columns and `rowClass`, and are display-only. Their ids must not clash with ids in `rows`.

```svelte
<Grid {rows} {columns} height={480} pinnedRows={[benchmark]} />
```

## Rows readers pin

`rowPinning` lets readers pin rows themselves. Right-clicking a row offers **Pin to top**, and **Unpin** on a pinned row, ahead of any `rowMenu` items.

- A pinned row shows above the scroll and also stays in its place in the body. It keeps updating, `api.patchRows` included.
- Pins are remembered with `persistKey`, and carried by `getState()` and `applyState()`.
- `onRowPinChange(ids)` reports every change.
- Pinning works on rows in `rows`; with a server `source`, pin rows of your own with `pinnedRows`.

```svelte
<Grid {rows} {columns} height={480} rowPinning persistKey="watchlist" onRowPinChange={(ids) => save(ids)} />
```

## From code

`api.pinRow(id)` pins a row and `api.pinRow(id, false)` unpins it; it returns `false` when no row has that id. `api.getPinnedRowIds()` returns the pinned ids in the order they were pinned.

```ts
api.pinRow(2);           // pin the row with id 2
api.pinRow(2, false);    // unpin it
api.getPinnedRowIds();   // [] again
```

## Reference

<Props names={['pinnedRows', 'rowPinning', 'onRowPinChange', 'persistKey']} />

<Props of="api" names={['pinRow', 'getPinnedRowIds']} />
