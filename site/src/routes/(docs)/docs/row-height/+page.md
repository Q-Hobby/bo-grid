---
title: Row height & grid size
description: Set the row height for the density you want, give rows their own heights, and size the grid in pixels or to fill its container.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Rows are 36 px tall by default. `rowHeight` sets another height for every row, or a height per row. The grid's own size comes from `height`: a number of pixels for the scrolling area, or a CSS length that sizes the whole grid to fit its container.

Switch between the three densities; the grid keeps scrolling smoothly at each:

<Example name="row-height" title="Compact, default and roomy rows" />

## One height for every row

```svelte
<Grid {rows} {columns} rowHeight={28} height={480} />
```

For a fully compact or roomy look, pair `rowHeight` with the theme's `cellPad` (horizontal padding) and `fontSize`; see [Theming](../theming/).

## A height per row

Pass a function of the row and its index, for rows that need more room, such as a wrapped note:

```svelte
<Grid {rows} {columns} rowHeight={(row, i) => (row.note ? 72 : 36)} height={480} />
```

Variable heights are virtualized with a prefix sum and a binary search, so scrolling stays fast with many rows. They need the rows in memory: with a server [data source](../server-data/), rows not yet loaded have no known height, so source mode uses one height.

Text only wraps in columns that ask for it with `wrap: true` (see [Custom cells](../custom-cells/#tooltips-and-truncation)).

## Sizing the grid

`height` takes a number or a CSS length:

- **A number** is the height of the scrolling area in pixels. The grid's full height is that plus its header, and any toolbar, pager or footer.
- **A CSS string** (`'100%'`, `'80vh'`, `'480px'`) sizes the whole grid, and the scrolling area fits the space left after its header and other parts. Give the grid a parent with a size, such as a flex or grid cell, for `'100%'` to fill.

```svelte
<Grid {rows} {columns} height={640} />  <!-- a 640 px scrolling area -->
<Grid {rows} {columns} height="100%" /> <!-- fill a sized parent -->
<Grid {rows} {columns} height="80vh" />
```

## Reference

<Props names={['rowHeight', 'height', 'detailHeight']} />

<Props of="column" names={['wrap']} />
