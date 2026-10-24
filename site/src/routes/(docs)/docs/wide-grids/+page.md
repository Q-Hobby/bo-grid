---
title: Wide grids
description: TODO
---

<script>
  import Example from '$lib/Example.svelte';
</script>

Rows are virtualized vertically by default. For very wide grids (100+ columns),
add **`virtualizeColumns`** to also virtualize horizontally — only the columns in
the scroll window (+ overscan) render, so a 60-column grid costs about the same as
a handful. It switches the grid to fixed-width horizontal scroll; **pinned columns
always render**. See the **Wide** example.

```svelte
<Grid {rows} {columns} virtualizeColumns height={520} />
```

On a wide board, **`columnHover`** highlights the column under the pointer,
body and header, so a value is easy to follow down its column. It draws one
overlay for the whole column rather than restyling each cell, and pinned columns
are covered too. The colour is the theme token `colHover`.

```svelte
<Grid {rows} {columns} columnHover height={520} />
```

## Live example

<Example id="wide" />
