---
title: Pinned columns
description: Keep key columns, such as a symbol or a total, in view on the left or right edge while the rest of the grid scrolls sideways.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

A pinned column stays in view while the other columns scroll sideways. Pin the column that identifies a row (a symbol, a name) to the left, and a summary column (a total, an action) to the right.

Scroll the grid sideways: Symbol stays on the left and Volume on the right while the returns in between scroll under them.

<Example name="pinned-columns" title="Columns pinned left and right" />

## Pinning a column

Set `pinned` on the column: `true` or `'left'` pins it to the left edge, `'right'` to the right edge.

```ts
const columns: ColumnDef[] = [
  { type: 'text', key: 'symbol', header: 'Symbol', width: 90, pinned: 'left' },
  { type: 'price', key: 'price', header: 'Price', width: 100 },
  // …more fixed-width columns scroll under the pinned ones…
  { type: 'volume', key: 'volume', header: 'Volume', width: 110, pinned: 'right' },
];
```

- Pinning is opt-in. With no pinned columns the grid fits its columns to its width and never scrolls sideways unless they don't fit.
- Give the scrolling columns fixed widths, so there is something to scroll.
- Users can pin and unpin from the [column menu](../column-moving/#the-column-menu) (`columnMenu`). Their pins are part of `api.getState()` and are remembered under `persistKey`.

## With wide grids

For grids with dozens or hundreds of columns, `virtualizeColumns` renders only the columns in the horizontal window. Pinned columns always render. See [Wide grids](../wide-grids/).

## Pinning rows

To keep rows in view instead, such as a watchlist's favourites, see `pinnedRows` and `rowPinning` in [Cell selection & clipboard](../selection/).

## Reference

<Props of="column" names={['pinned', 'width']} />

<Props names={['columnMenu', 'virtualizeColumns', 'persistKey']} />
