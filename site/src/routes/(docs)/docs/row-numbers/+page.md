---
title: Row numbers
description: TODO
---

`rowNumbers` adds a leading row-number column, as in a spreadsheet. Data rows
are numbered 1, 2, 3… in view order, so the numbers follow sorting and
filtering. Group headers get no number. The column is sticky when the grid
scrolls sideways, and sized to the widest number. Its cells are row headers,
so a screen reader announces the row's number with each cell. The header
reads "Row" (the `rowNumber` label).

```svelte
<Grid {rows} {columns} rowNumbers height={640} />
```
