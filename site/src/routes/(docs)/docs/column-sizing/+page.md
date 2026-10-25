---
title: Column sizing
description: Set fixed and flexible widths, let users resize columns, scale every column with the grid, and widen columns whose values outgrow them.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

Every column has a fixed `width` or a `flex` weight, and users can drag a header's edge to change it. Two switches change how columns respond to the grid's own width: `fitColumns` scales every column with it, and a column's `autoWidth` widens it when its values no longer fit.

Drag a header's right edge to resize: only that column changes. Double-click the edge to reset it. Toggle `fitColumns`, then resize the browser window to see the difference:

<Example name="column-sizing" title="Resizing and fitColumns" />

## Fixed and flexible widths

- **`width`** is a fixed width in pixels.
- **`flex`** is a grow weight: flex columns share the space that fixed columns leave, in proportion to their weights. `flex` wins over `width`.

By default, only flex columns take up a change in the grid's width; fixed columns stay as they are.

## Resizing

Drag the grip on a header's right edge to resize a column. Only that column changes: every other column keeps the width it has on screen, flex columns included, and the columns after it move along. When the columns grow wider than the grid, it scrolls sideways; when they shrink, the space is left at the right.

- Double-click a grip to give that column back its own width. A flex column then fills the space the others leave again.
- **Reset widths**, in the column menu (`columnMenu`), gives every column back its own width.
- Autosize, from the column menu or `api.autosizeColumns`, changes columns the same way: the others keep their widths.
- `minWidth` and `maxWidth` bound the drag.
- Resizing is on by default. Turn it off for the grid with `resizable={false}`, or for one column with `resizable: false`, for example a narrow action column.
- `onColumnResize(key, width)` reports each resize; `persistKey` remembers widths across reloads.

```svelte
<Grid {rows} {columns} persistKey="watchlist" onColumnResize={(key, width) => save(key, width)} height={480} />
```

## Scaling every column: fitColumns

With `fitColumns`, every column scales with the grid. Each gets a share of the width in proportion to its `width`, bounded by its `minWidth` and `maxWidth`. A column with no `minWidth` shrinks to 64 px at most (or keeps its own width, if that is smaller). The grid scrolls sideways only when those floors no longer fit.

```svelte
<Grid {rows} {columns} fitColumns height={480} />
```

`fitColumns` fits until the user sets a width. After a drag or an autosize, the columns keep the widths they were given, as they do without it, until **Reset widths** brings the fit back.

## Growing with the values: autoWidth

Values that grow, such as a price gaining a digit or a running volume total, can outgrow their column and end in "…". Set `autoWidth: true` on such a column and it widens to fit the values on screen.

```ts
{ type: 'volume', key: 'totalVol', header: 'Total vol', width: 76, autoWidth: true }
```

- It is checked at most every 500 ms, and values are measured on a canvas, so it never forces a layout on a live board.
- It only grows, so values flickering wider and narrower don't make the column jump. `maxWidth` caps it.
- A width the user dragged or autosized takes over from it.

## Autosizing from code

`api.autosizeColumns(keys?)` fits columns to their content, as the column menu's Autosize item does; with no keys it fits every resizable column. See [Grid API](../grid-api/).

## Reference

<Props of="column" names={['width', 'flex', 'minWidth', 'maxWidth', 'resizable', 'autoWidth']} />

<Props names={['resizable', 'fitColumns', 'onColumnResize', 'persistKey']} />

<Props of="api" names={['autosizeColumns']} />
