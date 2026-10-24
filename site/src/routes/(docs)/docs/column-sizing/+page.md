---
title: Column sizing
description: TODO
---

Drag the grip on a header's right edge to resize a column; **double-click** the
grip to reset it to its default width. Resizing a fit-to-width (`flex`) column
pins it to the dragged width and lets its neighbours absorb the difference.
Under `fitColumns` the edge still follows the pointer. The columns before it
keep their widths, and the ones after it share the difference in proportion.
The same `persistKey` remembers widths across reloads.

Bound a column's draggable range with `minWidth` / `maxWidth`. Resizing is on by
default. Turn it off for the whole grid with `resizable={false}`, or per column
with `resizable: false` (handy for a fixed action column):

```svelte
<Grid {rows} {columns} resizable={false} height={640} />
```
