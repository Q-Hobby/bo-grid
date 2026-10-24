---
title: Row height & grid size
description: TODO
---

Uniform 36px by default. Pass `rowHeight` as a number for a different density, or
a function for variable per-row heights (in-memory mode):

```svelte
<Grid {rows} {columns} rowHeight={48} height={640} />
<Grid {rows} {columns} rowHeight={(row, i) => (row.expanded ? 96 : 36)} height={640} />
```

Variable heights use a prefix-sum + binary-search virtualizer, so scrolling stays
O(log n). Source mode is uniform-only (unloaded row heights aren't known).

## Sizing the grid

`height` as a **number** is the scroll viewport's pixel height (the element is
that plus header/pager/footer chrome). Pass a **CSS string** to size the whole
element instead and let the viewport auto-fit the space left over — ideal for
filling a flex/grid cell:

```svelte
<Grid {rows} {columns} height={640} />        <!-- 640px viewport -->
<Grid {rows} {columns} height="100%" />        <!-- fill a sized parent -->
<Grid {rows} {columns} height="80vh" />
```
