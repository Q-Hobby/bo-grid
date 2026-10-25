---
title: Column definitions
description: Describe each column once, with a key, a header and a type, and the grid handles display, sorting, filtering and export.
---

<script>
  import Example from '$lib/Example.svelte';
  import Props from '$lib/Props.svelte';
</script>

A grid takes `columns`, an array of column definitions in display order. Each definition names the row field to read (`key`), the title to show (`header`), and a `type` that decides how the value is formatted, aligned, sorted and filtered. Everything else, such as width, pinning, tooltips and editing, is an optional field on the same object.

Sort a column from its header, hover a cut-off value for its tooltip, or drag a header edge to resize:

<Example name="columns" title="Column definitions" />

## The shape of a column

```svelte
<script lang="ts">
  import { Grid, type ColumnDef } from 'bo-grid';

  const columns: ColumnDef[] = [
    { type: 'text', key: 'symbol', header: 'Symbol', sub: 'name', width: 170 },
    { type: 'price', key: 'price', header: 'Price', width: 96 },
    { type: 'percent', key: 'change', header: 'Chg %', width: 90 },
    { type: 'volume', key: 'volume', header: 'Volume', width: 100 },
    { type: 'text', key: 'sector', header: 'Sector', flex: 1 },
  ];

  let rows = $state([
    { id: 1, symbol: 'VNM', name: 'Vinamilk', price: 68.5, change: 1.2, volume: 1_204_000, sector: 'Consumer' },
  ]);
</script>

<Grid {rows} {columns} height={400} />
```

- **`key`** is the row field the column reads. It is also the column's identity: sorting, filtering, hiding and saved layouts refer to columns by key, so keep keys unique.
- **`header`** is the title in the header row.
- **`type`** picks the cell's format and behaviour. `ColumnDef` is a union on `type`, so TypeScript checks each type's own options (`decimals` on `number`, `min` and `max` on `heatmap`, `currency` on `currency`). See [Column types](../column-types/) for the full list.
- Rows are plain objects with a unique `id`. If your data has another identity field, pass `getRowId` instead of copying it into `id`.

## Widths

A column is either fixed or flexible:

- **`width`** sets a fixed width in pixels.
- **`flex`** sets a grow weight: flex columns share the width that fixed columns leave over, in proportion to their weights. A column with `flex` ignores `width`.
- **`minWidth`** and **`maxWidth`** bound what a drag-resize can do.

To make every column scale with the grid instead, set `fitColumns` on the grid. [Column sizing](../column-sizing/) covers resizing, `fitColumns` and `autoWidth`.

## Alignment, classes and formatting

Number types line up on the right and the rest on the left. Set `align` to override that for one column, for example a custom column that holds numbers.

`format(value, row)` replaces the built-in formatter. It applies wherever the value is shown as text: the cell, its tooltip, copy and formatted export.

```ts
{ type: 'number', key: 'ratio', header: 'Ratio', format: (v) => `${Number(v).toFixed(1)}×` }
```

`cellClass` and `headerClass` add your own classes. `cellClass` can be a function of the value and the row. Rows render inside the grid, so target the classes with `:global(...)`; see [Row styles](../row-styles/).

## Defaults for every column

`defaultColumn` sets fields that every column starts from. A column's own fields, and a registered `cellType`, win over it:

```svelte
<Grid {rows} {columns} defaultColumn={{ tooltip: true, minWidth: 64, resizable: false }} height={480} />
```

To reuse a whole kind of column across grids, such as a money amount or an order status, register it once with `cellTypes`: see [Registered cell types](../column-types/#registered-cell-types).

## Locale

Built-in number, price, currency and date formatting uses `en-US` by default. Set the grid's `locale` to change it for every column, or a column's own `locale` to change one:

```svelte
<Grid {rows} {columns} locale="vi-VN" height={480} />
```

[Localization](../localization/) covers the grid's own strings too.

## Reference

<Props of="column" names={['key', 'header', 'width', 'flex', 'minWidth', 'maxWidth', 'align', 'format', 'cellClass', 'headerClass', 'sortable', 'locale']} />

<Props names={['columns', 'defaultColumn', 'getRowId', 'locale']} />
