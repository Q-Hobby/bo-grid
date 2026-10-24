---
title: Moving & hiding
description: TODO
---

Pass `onRowReorder(from, to)` to enable **drag-to-reorder rows** via a handle in
the first column — reorder your own `rows` array in the callback (flat, unsorted,
in-memory lists). Drag any column header to reorder columns; pass `persistKey` to
remember the user's order across reloads (saved to `localStorage`):

```svelte
<Grid {rows} {columns} persistKey="watchlist" height={640} />
```

## Column visibility

Pass `hiddenColumns` (column keys to hide) — controlled, like `filter`. Build
your own column-picker UI and drive the prop; the grid stays presentation-only:

```svelte
<Grid {rows} {columns} hiddenColumns={['bonus', 'rating']} height={640} />
```

Or set `columnMenu` for a **per-column header menu** (a ⋮ trigger, or
<kbd>Alt</kbd>+<kbd>↓</kbd> on the focused column) with **sort**, **pin**
(left/right/unpin), **Autosize** (fit to content), and **Hide column** actions,
and `columnsPanel` for a **"Columns" button** that opens a checklist to toggle
visibility (and restore hidden columns). Runtime hide/pin compose with
`hiddenColumns` / `col.pinned`, persist via `persistKey`, and hide reports through
`onColumnVisibilityChange`:

```svelte
<Grid {rows} {columns} columnMenu height={640}
  onColumnVisibilityChange={(hidden) => (myHidden = hidden)} />
```
