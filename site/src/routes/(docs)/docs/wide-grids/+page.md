---
title: Wide grids
description: Render only the columns in view for grids with dozens or hundreds of columns, and highlight the column under the pointer.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Rows are always virtualized: only the rows in view are drawn. For grids with many columns (a price history by day, a risk matrix, a wide export), `virtualizeColumns` does the same across: only the columns in the horizontal scroll window, plus a small buffer, are drawn, so a grid of a hundred columns costs about as much as one of ten.

41 columns, of which only the visible ones render. Scroll sideways; the Symbol column stays pinned, and the column under the pointer lights up.

<Example name="wide-grids" title="Column virtualization" />

## Turning it on

```svelte
<Grid {rows} {columns} height={520} virtualizeColumns />
```

- Columns get pixel widths and the grid scrolls horizontally; `flex` columns grow to fill any width left over.
- Pinned columns always render, so a label column stays put on the left (or right). See [Pinned columns](../pinned-columns/).
- `colSpan` is ignored while columns are virtualized: every cell draws in its own column.

Without `virtualizeColumns`, columns fit the grid's width and every column renders, which is the better choice up to a few dozen columns.

## Following a column

On a wide board, `columnHover` highlights the column under the pointer, body and header, so a value is easy to follow down its column. It draws one overlay for the whole column rather than restyling each cell, and covers pinned columns too. Its colour is the theme token `colHover`.

```svelte
<Grid {rows} {columns} height={520} virtualizeColumns columnHover />
```

## Sixty columns

A wide board with a pinned label column:

<Example id="wide" />

## Reference

<Props names={['virtualizeColumns', 'columnHover']} />

<Props of="column" names={['pinned', 'width', 'colSpan']} />
